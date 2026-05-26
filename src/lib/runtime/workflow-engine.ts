import { runtimeLogger } from '@/lib/logger/runtime-logger';
import { db } from '@/server/db/client';

export interface WorkflowInstance {
  trigger: string; // e.g. "employees.created"
  action: 'send_notification' | 'log_action' | 'create_record';
  config?: Record<string, any>;
}

// Global hook/observer structure to notify frontend about workflow runs in real-time
type WorkflowListener = (event: {
  id: string;
  timestamp: string;
  trigger: string;
  action: string;
  status: 'success' | 'failure';
  message: string;
}) => void;

const workflowListeners = new Set<WorkflowListener>();

export const workflowEventHub = {
  subscribe(listener: WorkflowListener) {
    workflowListeners.add(listener);
    return () => { workflowListeners.delete(listener); };
  },
  
  publish(event: any) {
    workflowListeners.forEach(listener => {
      try { listener(event); } catch (e) {}
    });
    
    // Dispatch in-browser custom event if active
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('forgeai-workflow-trigger', { detail: event }));
    }
  }
};

/**
 * Resolves template strings like "Hi {payload.fullName} from {payload.department}!"
 */
function resolveTemplate(template: string, payload: any): string {
  if (!template) return '';
  return template.replace(/\{payload\.([a-zA-Z0-9_]+)\}/g, (match, fieldName) => {
    return payload[fieldName] !== undefined ? String(payload[fieldName]) : match;
  });
}

export const workflowEngine = {
  /**
   * Triggers workflow processing based on dynamic db hooks
   */
  async executeTrigger(
    appId: string,
    triggerEvent: string, // e.g. "employees.created"
    payload: any
  ): Promise<void> {
    try {
      // 1. Fetch active application config
      const app = await db.appConfig.findUnique({
        where: { id: appId },
      });

      if (!app) {
        runtimeLogger.warn('workflow', `Encountered trigger event ${triggerEvent} but app ${appId} was not found.`);
        return;
      }

      const schema = typeof app.schema === 'string' ? JSON.parse(app.schema) : app.schema;
      const workflows: WorkflowInstance[] = schema.workflows || [];
      
      // 2. Filter workflows matching trigger
      const activeWorkflows = workflows.filter(w => w.trigger === triggerEvent);
      if (activeWorkflows.length === 0) return;

      runtimeLogger.info('workflow', `Dispatched trigger: ${triggerEvent}. Running ${activeWorkflows.length} automation workflows.`, { appId, triggerEvent });

      // 3. Process each workflow asynchronously
      for (const flow of activeWorkflows) {
        const flowId = Math.random().toString(36).substring(2, 9);
        const startTime = new Date().toISOString();
        
        try {
          if (flow.action === 'log_action') {
            const template = flow.config?.message || 'Workflow logged action for {payload.id}';
            const logMsg = resolveTemplate(template, payload);
            
            runtimeLogger.info('workflow', `[Workflow Log]: ${logMsg}`, { appId, flow }, appId);
            
            workflowEventHub.publish({
              id: flowId,
              timestamp: startTime,
              trigger: triggerEvent,
              action: flow.action,
              status: 'success',
              message: logMsg,
            });
          } 
          
          else if (flow.action === 'send_notification') {
            const template = flow.config?.message || 'Notification triggered for {payload.id}';
            const notificationMsg = resolveTemplate(template, payload);
            
            runtimeLogger.info('workflow', `[Workflow Notification]: ${notificationMsg}`, { appId }, appId);
            
            // Persist notification locally in browser if browser environment
            if (typeof window !== 'undefined') {
              try {
                const stored = localStorage.getItem('forgeai_notifications');
                const notifications = stored ? JSON.parse(stored) : [];
                notifications.unshift({
                  id: flowId,
                  timestamp: startTime,
                  message: notificationMsg,
                  appId,
                  read: false
                });
                localStorage.setItem('forgeai_notifications', JSON.stringify(notifications));
                window.dispatchEvent(new CustomEvent('forgeai-notification-new'));
              } catch (e) {}
            }
            
            workflowEventHub.publish({
              id: flowId,
              timestamp: startTime,
              trigger: triggerEvent,
              action: flow.action,
              status: 'success',
              message: notificationMsg,
            });
          } 
          
          else if (flow.action === 'create_record') {
            const targetEntity = flow.config?.entity;
            const fieldTemplate = flow.config?.fields || {};
            
            if (!targetEntity) {
              throw new Error('create_record action missing config.entity schema mapping');
            }
            
            // Build the cascading insert payload dynamically resolving templates
            const targetPayload: Record<string, any> = {};
            Object.keys(fieldTemplate).forEach(fieldName => {
              const val = fieldTemplate[fieldName];
              if (typeof val === 'string') {
                targetPayload[fieldName] = resolveTemplate(val, payload);
              } else {
                targetPayload[fieldName] = val;
              }
            });

            // Insert dynamic cascading record
            const createdRecord = await db.runtimeRecord.create({
              data: {
                appId,
                entityName: targetEntity,
                payload: targetPayload
              }
            });

            const successMsg = `Automated cascading insert: Created record in [${targetEntity}] mapping ID ${createdRecord.id}.`;
            runtimeLogger.info('workflow', successMsg, { targetEntity, targetPayload }, appId);
            
            workflowEventHub.publish({
              id: flowId,
              timestamp: startTime,
              trigger: triggerEvent,
              action: flow.action,
              status: 'success',
              message: successMsg,
            });
          }
        } catch (flowError) {
          const errMsg = flowError instanceof Error ? flowError.message : String(flowError);
          runtimeLogger.error('workflow', `Automation workflow failed to execute action: ${flow.action}`, {
            error: errMsg,
            workflow: flow
          }, appId);
          
          workflowEventHub.publish({
            id: flowId,
            timestamp: startTime,
            trigger: triggerEvent,
            action: flow.action,
            status: 'failure',
            message: `Execution failed: ${errMsg}`,
          });
        }
      }
    } catch (e) {
      runtimeLogger.error('workflow', 'Core workflow trigger execution failed', {
        error: e instanceof Error ? e.message : String(e)
      }, appId);
    }
  }
};

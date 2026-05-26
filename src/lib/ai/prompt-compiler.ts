import { runtimeLogger } from '@/lib/logger/runtime-logger';
import { AppSchemaType } from '../schema/schema-validator';

// 1. Core Mock Schema catalog for high-quality local parser prompts
const PRECONFIGURED_SCHEMAS: Record<string, any> = {
  crm: {
    appName: 'Employee & Client CRM',
    description: 'A professional platform managing corporate staff, departments, salaries, and client relationships.',
    entities: [
      {
        name: 'employees',
        label: 'Employees Directory',
        fields: [
          { name: 'fullName', type: 'text', required: true, placeholder: 'Enter full name' },
          { name: 'email', type: 'text', required: true, placeholder: 'name@company.com' },
          { name: 'department', type: 'select', required: true, options: ['Engineering', 'Product', 'Marketing', 'Sales', 'HR', 'Finance'], defaultValue: 'Engineering' },
          { name: 'salary', type: 'number', required: false, placeholder: 'Annual USD salary' },
          { name: 'employmentType', type: 'select', required: true, options: ['fulltime', 'parttime', 'contractor'], defaultValue: 'fulltime' },
          { 
            name: 'bonusRate', 
            type: 'number', 
            placeholder: 'Contractor hourly rate / bonus',
            visibleIf: { field: 'employmentType', equals: 'contractor' }
          },
          { name: 'isActive', type: 'checkbox', defaultValue: true }
        ],
        layout: { columns: 2 }
      },
      {
        name: 'clients',
        label: 'Corporate Clients',
        fields: [
          { name: 'companyName', type: 'text', required: true, placeholder: 'Acme Corp' },
          { name: 'contactPerson', type: 'text', required: true, placeholder: 'Jane Doe' },
          { name: 'accountValue', type: 'number', placeholder: 'Contract value' },
          { name: 'status', type: 'select', options: ['Lead', 'Negotiating', 'Active', 'Churned'], defaultValue: 'Lead' },
          { name: 'notes', type: 'textarea', placeholder: 'Interaction records...' }
        ],
        layout: { columns: 1 }
      }
    ],
    workflows: [
      {
        trigger: 'employees.created',
        action: 'send_notification',
        config: { message: 'Welcome aboard! A new profile has been initialized for {payload.fullName} in the {payload.department} team.' }
      },
      {
        trigger: 'clients.created',
        action: 'log_action',
        config: { message: 'Client acquisition logged: {payload.companyName} has registered as a new {payload.status}.' }
      }
    ]
  },
  student: {
    appName: 'Student Academy Portal',
    description: 'An educational management system tracking courses, grades, teacher assignments, and registrations.',
    entities: [
      {
        name: 'students',
        label: 'Student Register',
        fields: [
          { name: 'studentName', type: 'text', required: true, placeholder: 'Alex Smith' },
          { name: 'rollNumber', type: 'text', required: true, placeholder: 'STU-2026-001' },
          { name: 'grade', type: 'select', options: ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'], defaultValue: 'Grade 10' },
          { name: 'enrollmentDate', type: 'date', required: true },
          { name: 'parentEmail', type: 'text', placeholder: 'parent@home.com' },
          { name: 'gpa', type: 'number', placeholder: '0.0 - 4.0' }
        ],
        layout: { columns: 2 }
      },
      {
        name: 'courses',
        label: 'Academic Courses',
        fields: [
          { name: 'courseName', type: 'text', required: true, placeholder: 'Intro to AI' },
          { name: 'instructor', type: 'text', required: true, placeholder: 'Dr. Turing' },
          { name: 'department', type: 'select', options: ['STEM', 'Humanities', 'Arts', 'Physical Ed'], defaultValue: 'STEM' },
          { name: 'credits', type: 'number', defaultValue: 3 }
        ],
        layout: { columns: 1 }
      }
    ],
    workflows: [
      {
        trigger: 'students.created',
        action: 'send_notification',
        config: { message: 'Student Enrollment: Registered student {payload.studentName} (ID: {payload.rollNumber}) in class {payload.grade}.' }
      }
    ]
  },
  hospital: {
    appName: 'MediCore Clinical Hub',
    description: 'A secure healthcare dynamic dashboard monitoring patient check-ins, doctors, and prescription alerts.',
    entities: [
      {
        name: 'patients',
        label: 'Active Admittances',
        fields: [
          { name: 'patientName', type: 'text', required: true, placeholder: 'John Doe' },
          { name: 'age', type: 'number', required: true, placeholder: 'Age in years' },
          { name: 'bloodGroup', type: 'select', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], defaultValue: 'O+' },
          { name: 'admissionDate', type: 'date', required: true },
          { name: 'roomNumber', type: 'text', required: true, placeholder: 'e.g. ICU-302' },
          { name: 'symptoms', type: 'textarea', placeholder: 'Ailments recorded at check-in...' }
        ],
        layout: { columns: 2 }
      },
      {
        name: 'doctors',
        label: 'Medical Specialists',
        fields: [
          { name: 'doctorName', type: 'text', required: true, placeholder: 'Dr. Gregory House' },
          { name: 'specialty', type: 'select', options: ['General Medicine', 'Cardiology', 'Pediatrics', 'Oncology', 'Neurology'], defaultValue: 'General Medicine' },
          { name: 'onCallDuty', type: 'checkbox', defaultValue: false },
          { name: 'pagerContact', type: 'text', placeholder: 'Pager number' }
        ],
        layout: { columns: 1 }
      }
    ],
    workflows: [
      {
        trigger: 'patients.created',
        action: 'send_notification',
        config: { message: 'Emergency check-in: Admitted patient {payload.patientName} (Age: {payload.age}) to Room {payload.roomNumber}.' }
      }
    ]
  },
  project: {
    appName: 'Agile Project Board',
    description: 'A developer project workspace tracking sprint issues, assigned staff, status phases, and task logs.',
    entities: [
      {
        name: 'tasks',
        label: 'Sprint Backlog',
        fields: [
          { name: 'title', type: 'text', required: true, placeholder: 'Implement dynamic forms' },
          { name: 'assignee', type: 'text', placeholder: 'Engineer name' },
          { name: 'priority', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'], defaultValue: 'Medium' },
          { name: 'dueDate', type: 'date' },
          { name: 'estimateHours', type: 'number', placeholder: 'Sprint points' },
          { name: 'description', type: 'textarea', placeholder: 'Task specifications...' }
        ],
        layout: { columns: 2 }
      }
    ],
    workflows: [
      {
        trigger: 'tasks.created',
        action: 'log_action',
        config: { message: 'Sprint task logged: "{payload.title}" assigned to {payload.assignee} with priority {payload.priority}.' }
      }
    ]
  }
};

/**
 * Intelligent Local Prompt Engine matching key themes
 */
function compileLocalPrompt(prompt: string): AppSchemaType {
  const p = prompt.toLowerCase();
  
  if (p.includes('crm') || p.includes('employee') || p.includes('client') || p.includes('staff')) {
    return PRECONFIGURED_SCHEMAS.crm;
  }
  if (p.includes('student') || p.includes('school') || p.includes('class') || p.includes('academy') || p.includes('university')) {
    return PRECONFIGURED_SCHEMAS.student;
  }
  if (p.includes('hospital') || p.includes('patient') || p.includes('doctor') || p.includes('clinic') || p.includes('medical')) {
    return PRECONFIGURED_SCHEMAS.hospital;
  }
  if (p.includes('project') || p.includes('task') || p.includes('bug') || p.includes('jira') || p.includes('todo')) {
    return PRECONFIGURED_SCHEMAS.project;
  }

  // Generic Dynamic Schema Builder for custom inputs
  const words = p.replace(/[^a-zA-Z0-9 ]/g, '').split(' ');
  const possibleName = words
    .filter(w => w.length > 3 && w !== 'build' && w !== 'create' && w !== 'generate' && w !== 'system')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const appName = possibleName ? `${possibleName} Manager` : 'Dynamic Application Workspace';

  return {
    appName,
    description: `A customized workspace generated dynamically for prompt: "${prompt}".`,
    entities: [
      {
        name: 'records',
        label: 'Primary Ledger',
        fields: [
          { name: 'title', type: 'text', required: true, placeholder: 'Record title / identifier' },
          { name: 'category', type: 'select', options: ['General', 'Operation', 'Support', 'Custom'], defaultValue: 'General' },
          { name: 'quantity', type: 'number', placeholder: 'Numeric quantity / value' },
          { name: 'registeredDate', type: 'date' },
          { name: 'notes', type: 'textarea', placeholder: 'Detailed records...' }
        ],
        layout: { columns: 2 }
      }
    ],
    workflows: [
      {
        trigger: 'records.created',
        action: 'send_notification',
        config: { message: 'A new transaction has been registered in the primary ledger: "{payload.title}".' }
      }
    ]
  } as any as AppSchemaType;
}

/**
 * dual-mode compiler triggering Gemini API or reverting to local keyword parser
 */
export async function compilePromptToSchema(prompt: string): Promise<AppSchemaType> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    runtimeLogger.info('ai', 'GEMINI_API_KEY is not configured in .env. Activating Intelligent Local Parser fallback.', { prompt });
    return compileLocalPrompt(prompt);
  }

  try {
    runtimeLogger.info('ai', 'Contacting Google Gemini API beta client...', { prompt });
    
    // Construct the structured prompt instructing Gemini to return a clean ForgeAI JSON schema
    const instructions = `
You are a senior full-stack architect specializing in runtime dynamic platforms like Retool and Base44.
Your task is to convert a user NLP building prompt into a highly structured dynamic JSON schema matching the ForgeAI engine model.

The schema MUST follow this TypeScript definition shape exactly:
interface AppSchema {
  appName: string;
  description: string;
  entities: Array<{
    name: string; // Lowercase, URL-friendly plural name (e.g. "employees", "tasks")
    label?: string; // Human-friendly plural label
    fields: Array<{
      name: string; // CamelCase field key (e.g. "fullName", "email")
      type: "text" | "number" | "select" | "textarea" | "checkbox" | "date";
      required?: boolean;
      options?: string[]; // Mandatory if type is "select"
      placeholder?: string;
      defaultValue?: any;
      visibleIf?: {
        field: string; // target field key name
        equals: any; // matching value
      }
    }>;
    layout?: {
      columns?: number; // 1 to 4
    }
  }>;
  workflows?: Array<{
    trigger: string; // Event key e.g. "[entityName].created", "[entityName].deleted"
    action: "send_notification" | "log_action" | "create_record";
    config?: Record<string, any>; // If action is "send_notification", config should contain { "message": "Hi {payload.fieldName}" }. If "create_record", config should contain { "entity": "otherEntityName", "fields": { "fieldName": "templateVal" } }
  }>;
}

Guidelines:
1. Generate multi-entity schemas whenever appropriate. E.g. a School system should have "students" and "courses".
2. Ensure you provide meaningful placeholders, defaults, and select options.
3. Keep the JSON clean, with NO surrounding markdown or extra text. Return ONLY the JSON schema.
4. If the user prompt is simple, enrich it with standard professional enterprise columns.

User Prompt: "${prompt}"
`;

    // Direct REST API fetch to Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instructions }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error('Gemini API returned an empty completion response');
    }

    // Parse returned JSON text
    const generatedSchema = JSON.parse(responseText.trim());
    
    // Perform simple validation on returned schema structure
    if (!generatedSchema.appName || !Array.isArray(generatedSchema.entities)) {
      throw new Error('Gemini schema structure missing key appName or entities array');
    }

    runtimeLogger.info('ai', 'Gemini API successfully compiled prompt into structured JSON schema!', { appName: generatedSchema.appName });
    return generatedSchema as AppSchemaType;
  } catch (error) {
    runtimeLogger.warn('ai', 'Gemini compilation failed or returned malformed JSON. Invoking local rule-based recovery compiler.', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Graceful fallback to our intelligent local parser
    return compileLocalPrompt(prompt);
  }
}

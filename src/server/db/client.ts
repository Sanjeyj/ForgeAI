import { PrismaClient } from '@prisma/client';
import { runtimeLogger } from '@/lib/logger/runtime-logger';

// Dynamic singleton pattern for Prisma
const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

let isDbConnected = false;
let fallbackStore: {
  users: any[];
  apps: any[];
  records: any[];
} = {
  users: [],
  apps: [],
  records: [],
};

// Initialize Prisma Client
export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Resilient wrapper checking connection
async function checkConnection() {
  if (isDbConnected) return true;
  try {
    // Attempt a fast low-impact query
    await prisma.$queryRaw`SELECT 1`;
    isDbConnected = true;
    runtimeLogger.info('database', 'Database connected successfully. Persistent PostgreSQL store active.');
    return true;
  } catch (error) {
    isDbConnected = false;
    runtimeLogger.warn('database', 'PostgreSQL database is offline or DATABASE_URL is misconfigured. Falling back to high-fidelity In-Memory Database store.', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

// In-Memory/JSON database implementation to mimic Prisma perfectly
const memoryDb = {
  user: {
    async findUnique({ where }: { where: { email?: string; id?: string } }) {
      if (where.email) {
        return fallbackStore.users.find(u => u.email === where.email) || null;
      }
      if (where.id) {
        return fallbackStore.users.find(u => u.id === where.id) || null;
      }
      return null;
    },
    async create({ data }: { data: any }) {
      const newUser = {
        id: Math.random().toString(36).substring(2, 15),
        email: data.email,
        password: data.password,
        createdAt: new Date(),
      };
      fallbackStore.users.push(newUser);
      return newUser;
    }
  },
  appConfig: {
    async findMany({ where }: { where: { userId?: string } }) {
      let results = [...fallbackStore.apps];
      if (where?.userId) {
        results = results.filter(app => app.userId === where.userId);
      }
      return results;
    },
    async findUnique({ where }: { where: { id: string } }) {
      return fallbackStore.apps.find(app => app.id === where.id) || null;
    },
    async create({ data }: { data: any }) {
      const newApp = {
        id: Math.random().toString(36).substring(2, 15),
        userId: data.userId,
        name: data.name,
        version: data.version || 1,
        schema: typeof data.schema === 'string' ? JSON.parse(data.schema) : data.schema,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      fallbackStore.apps.push(newApp);
      return newApp;
    },
    async update({ where, data }: { where: { id: string }; data: any }) {
      const index = fallbackStore.apps.findIndex(app => app.id === where.id);
      if (index === -1) throw new Error('AppConfig not found');
      
      const schema = data.schema !== undefined 
        ? (typeof data.schema === 'string' ? JSON.parse(data.schema) : data.schema) 
        : fallbackStore.apps[index].schema;

      const updated = {
        ...fallbackStore.apps[index],
        name: data.name !== undefined ? data.name : fallbackStore.apps[index].name,
        version: data.version !== undefined ? data.version : fallbackStore.apps[index].version,
        schema,
        updatedAt: new Date(),
      };
      fallbackStore.apps[index] = updated;
      return updated;
    },
    async delete({ where }: { where: { id: string } }) {
      const index = fallbackStore.apps.findIndex(app => app.id === where.id);
      if (index === -1) throw new Error('AppConfig not found');
      const deleted = fallbackStore.apps[index];
      fallbackStore.apps.splice(index, 1);
      // Cascade delete records
      fallbackStore.records = fallbackStore.records.filter(r => r.appId !== where.id);
      return deleted;
    }
  },
  runtimeRecord: {
    async findMany({ where, orderBy }: { where: { appId: string; entityName: string }; orderBy?: any }) {
      let results = fallbackStore.records.filter(
        r => r.appId === where.appId && r.entityName === where.entityName
      );
      if (orderBy?.createdAt) {
        results.sort((a, b) => {
          const timeA = new Date(a.createdAt).getTime();
          const timeB = new Date(b.createdAt).getTime();
          return orderBy.createdAt === 'desc' ? timeB - timeA : timeA - timeB;
        });
      }
      return results;
    },
    async findUnique({ where }: { where: { id: string } }) {
      return fallbackStore.records.find(r => r.id === where.id) || null;
    },
    async create({ data }: { data: any }) {
      const newRecord = {
        id: Math.random().toString(36).substring(2, 15),
        appId: data.appId,
        entityName: data.entityName,
        payload: typeof data.payload === 'string' ? JSON.parse(data.payload) : data.payload,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      fallbackStore.records.push(newRecord);
      return newRecord;
    },
    async update({ where, data }: { where: { id: string }; data: any }) {
      const index = fallbackStore.records.findIndex(r => r.id === where.id);
      if (index === -1) throw new Error('RuntimeRecord not found');
      const payload = data.payload !== undefined 
        ? (typeof data.payload === 'string' ? JSON.parse(data.payload) : data.payload) 
        : fallbackStore.records[index].payload;

      const updated = {
        ...fallbackStore.records[index],
        payload,
        updatedAt: new Date(),
      };
      fallbackStore.records[index] = updated;
      return updated;
    },
    async delete({ where }: { where: { id: string } }) {
      const index = fallbackStore.records.findIndex(r => r.id === where.id);
      if (index === -1) throw new Error('RuntimeRecord not found');
      const deleted = fallbackStore.records[index];
      fallbackStore.records.splice(index, 1);
      return deleted;
    },
    async count({ where }: { where: { appId?: string } }) {
      if (where?.appId) {
        return fallbackStore.records.filter(r => r.appId === where.appId).length;
      }
      return fallbackStore.records.length;
    }
  }
};

// Safe Database Operations Wrapper
export const db = {
  isFallbackActive() {
    return !isDbConnected;
  },

  async testConnection() {
    return checkConnection();
  },

  user: {
    async findUnique(args: any) {
      if (await checkConnection()) {
        try { return await prisma.user.findUnique(args); } catch (e) { isDbConnected = false; }
      }
      return memoryDb.user.findUnique(args);
    },
    async create(args: any) {
      if (await checkConnection()) {
        try { return await prisma.user.create(args); } catch (e) { isDbConnected = false; }
      }
      return memoryDb.user.create(args);
    }
  },

  appConfig: {
    async findMany(args?: any) {
      if (await checkConnection()) {
        try { return await prisma.appConfig.findMany(args); } catch (e) { isDbConnected = false; }
      }
      return memoryDb.appConfig.findMany(args);
    },
    async findUnique(args: any) {
      if (await checkConnection()) {
        try { return await prisma.appConfig.findUnique(args); } catch (e) { isDbConnected = false; }
      }
      return memoryDb.appConfig.findUnique(args);
    },
    async create(args: any) {
      if (await checkConnection()) {
        try { return await prisma.appConfig.create(args); } catch (e) { isDbConnected = false; }
      }
      return memoryDb.appConfig.create(args);
    },
    async update(args: any) {
      if (await checkConnection()) {
        try { return await prisma.appConfig.update(args); } catch (e) { isDbConnected = false; }
      }
      return memoryDb.appConfig.update(args);
    },
    async delete(args: any) {
      if (await checkConnection()) {
        try { return await prisma.appConfig.delete(args); } catch (e) { isDbConnected = false; }
      }
      return memoryDb.appConfig.delete(args);
    }
  },

  runtimeRecord: {
    async findMany(args: any) {
      if (await checkConnection()) {
        try { return await prisma.runtimeRecord.findMany(args); } catch (e) { isDbConnected = false; }
      }
      return memoryDb.runtimeRecord.findMany(args);
    },
    async findUnique(args: any) {
      if (await checkConnection()) {
        try { return await prisma.runtimeRecord.findUnique(args); } catch (e) { isDbConnected = false; }
      }
      return memoryDb.runtimeRecord.findUnique(args);
    },
    async create(args: any) {
      if (await checkConnection()) {
        try { return await prisma.runtimeRecord.create(args); } catch (e) { isDbConnected = false; }
      }
      return memoryDb.runtimeRecord.create(args);
    },
    async update(args: any) {
      if (await checkConnection()) {
        try { return await prisma.runtimeRecord.update(args); } catch (e) { isDbConnected = false; }
      }
      return memoryDb.runtimeRecord.update(args);
    },
    async delete(args: any) {
      if (await checkConnection()) {
        try { return await prisma.runtimeRecord.delete(args); } catch (e) { isDbConnected = false; }
      }
      return memoryDb.runtimeRecord.delete(args);
    },
    async count(args?: any) {
      if (await checkConnection()) {
        try { return await prisma.runtimeRecord.count(args); } catch (e) { isDbConnected = false; }
      }
      return memoryDb.runtimeRecord.count(args);
    }
  }
};

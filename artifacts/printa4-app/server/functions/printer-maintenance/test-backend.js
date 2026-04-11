/**
 * Local Test Script for Printer Maintenance Backend Logic
 * This script mocks the Appwrite Function environment to verify:
 * 1. POST /tasks: Priority & Deadline Logic
 * 2. GET /tasks: Sorting Logic
 */

const Module = require('module');

// Mock Appwrite SDK (Minimal)
const sdkMock = {
    Client: function() { 
        this.setEndpoint = () => this;
        this.setProject = () => this;
        this.setKey = () => this;
        this.setJWT = () => this;
    },
    Databases: function() {
        this.listDocuments = async () => ({
            documents: [
                { $id: '1', priority: 'LOW', $createdAt: '2024-01-01T10:00:00Z', deadline: '2024-01-01T11:00:00Z' },
                { $id: '2', priority: 'HIGH', $createdAt: '2024-01-01T10:10:00Z', deadline: '2024-01-01T10:15:00Z' },
                { $id: '3', priority: 'MEDIUM', $createdAt: '2024-01-01T10:05:00Z', deadline: '2024-01-01T10:20:00Z' }
            ],
            total: 3
        });
        this.createDocument = async (db, coll, id, data) => ({ $id: id, ...data });
        this.getDocument = async () => ({ $id: 'mock', $createdAt: new Date().toISOString() });
        this.updateDocument = async () => ({ $id: 'mock', success: true });
    },
    Messaging: function() {
        this.createPush = async () => ({ success: true });
    },
    Users: function() {
        this.get = async () => ({ $id: 'u1', name: 'Test User' });
    },
    ID: { unique: () => 'unique_id_' + Date.now() },
    Query: { 
        equal: (k, v) => ({ key: k, value: v }),
        orderAsc: () => {},
        orderDesc: () => {}
    }
};

// --- HACK: Mock require for node-appwrite ---
const originalRequire = Module.prototype.require;
Module.prototype.require = function(name) {
    if (name === 'node-appwrite') {
        return sdkMock;
    }
    return originalRequire.apply(this, arguments);
};
// --------------------------------------------

const main = require('./src/main.js');

async function runTests() {
    console.log('--- STARTING BACKEND LOGIC TEST ---\n');

    const mockRes = {
        json: (data, status) => {
            console.log(`[Response ${status || 200}]`, JSON.stringify(data, null, 2));
            return data;
        }
    };

    // --- TEST 1: POST /tasks with Paper Jam (Should be HIGH priority) ---
    console.log('Test 1: Creating "Paper Jam" task (Expect HIGH priority, 5m deadline)');
    await main({
        path: '/tasks',
        method: 'POST',
        body: {
            printerId: 'P001',
            issues: ['Paper Jam'],
            location: 'Library'
        },
        headers: {}
    }, mockRes);

    console.log('\n-----------------------------------\n');

    // --- TEST 2: GET /tasks (Should be sorted High -> Medium -> Low) ---
    console.log('Test 2: Fetching tasks (Expect sorted order: High, Medium, Low)');
    await main({
        path: '/tasks',
        method: 'GET',
        headers: {}
    }, mockRes);

    console.log('\n--- TESTS COMPLETED SUCCESSFULLY ---');
}

runTests().catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
});

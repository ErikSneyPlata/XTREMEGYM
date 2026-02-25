import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import * as clientController from '../controllers/clientController.js';
import * as inventoryController from '../controllers/inventoryController.js';
import * as salesController from '../controllers/salesController.js';
import * as statsController from '../controllers/statsController.js';
import * as membershipController from '../controllers/membershipController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Public Auth
router.post('/auth/login', authController.login);
router.post('/auth/register', authController.createAdmin); // In a real app, this might be protected

// Protected Routes
router.use(authenticateToken);

// Dashboard
router.get('/stats/dashboard', statsController.getDashboardStats);

// Clients
router.get('/clients', clientController.getClients);
router.post('/clients', clientController.createClient);
router.put('/clients/:id', clientController.updateClient);
router.get('/clients/:id/stats', clientController.getClientStats);

// Memberships
router.get('/plans', membershipController.getPlans);
router.post('/memberships/pay', membershipController.registerMembershipPayment);

// Inventory
router.get('/products', inventoryController.getProducts);
router.post('/products', inventoryController.createProduct);
router.put('/products/:id', inventoryController.updateProduct);
router.delete('/products/:id', inventoryController.deleteProduct);

// Sales (POS)
router.get('/sales', salesController.getSales);
router.post('/sales', salesController.createSale);

// Check-ins
router.post('/checkins', statsController.registerCheckIn);

export default router;

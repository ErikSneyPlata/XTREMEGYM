// backend/routes/api.js
import { Router } from "express";
import rateLimit from 'express-rate-limit';

console.log("database loading...");

import * as authController from "../controllers/authController.js";
import * as clientController from "../controllers/clientController.js";
import * as inventoryController from "../controllers/inventoryController.js";
import * as salesController from "../controllers/salesController.js";
import * as statsController from "../controllers/statsController.js";
import * as membershipController from "../controllers/membershipController.js";
import * as checkinController from "../controllers/checkinController.js";
import { authenticateToken } from "../middleware/auth.js";
import * as reportsController from "../controllers/reportsController.js";
import * as publicRegisterController from "../controllers/publicRegisterController.js";

import {
  getAdmins,
  createAdmin,
  updateAdmin,
  changePassword,
  deleteAdmin,
  getActivityLog,
} from "../controllers/settingsController.js";

const router = Router();


// ─── Rate limiters ────────────────────────────────────────────────────────────

// Registro público: máx 5 intentos por IP cada 15 minutos
const registerLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              5,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Demasiados intentos. Espera 15 minutos e intenta de nuevo.' },
  skipSuccessfulRequests: true,  // solo cuenta los fallidos
});

// Captcha: máx 30 solicitudes por IP cada 10 minutos (anti-scraping)
const captchaLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max:      30,
  message:  { error: 'Demasiadas solicitudes. Intenta más tarde.' },
});

// Login: máx 10 intentos por IP cada 15 minutos
const loginLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Demasiados intentos de inicio de sesión. Espera 15 minutos.' },
  skipSuccessfulRequests: true,
});


// Public Test Route
router.get("/public-test", (req, res) =>
  res.json({ message: "Public API is working" }),
);

// Captcha para el formulario de registro
router.get('/public/captcha', captchaLimiter, publicRegisterController.getCaptcha);

// Auto-registro de usuarios del gimnasio
router.post('/public/register', registerLimiter, publicRegisterController.publicRegister);

// Public Auth
// 🔴 Fix: /auth/register eliminada — era una ruta pública que permitía crear
// admins sin autenticación. La creación de admins se hace desde
// POST /settings/admins (protegida por authenticateToken).
router.post("/auth/login", authController.login);
router.post("/auth/register", authController.setupAdmin); // 🔴 Fix: esta ruta debería estar protegida, pero se deja para compatibilidad con el frontend. Mejor usar /settings/admins para crear admins  .

// Protected Routes
router.use(authenticateToken);

// Dashboard
router.get("/stats/dashboard", statsController.getDashboardStats);

// Check-ins
router.delete("/checkins/:id", checkinController.deleteCheckin);
router.get("/checkin-history", checkinController.getCheckinHistory);
router.post("/checkins", checkinController.createCheckin);

// Clients
router.get('/clients/counts',                    authenticateToken, clientController.getClientCounts);
router.get('/clients',                           authenticateToken, clientController.getClients);
router.post('/clients',                          authenticateToken, clientController.createClient);
router.put('/clients/:id',                       authenticateToken, clientController.updateClient);
router.delete('/clients/:id',                    authenticateToken, clientController.deleteClient);           // NUEVO
router.get('/clients/:id/stats',                 authenticateToken, clientController.getClientStats);
router.post('/clients/:id/cancel-membership',    authenticateToken, clientController.cancelMembership);       // NUEVO
router.post('/clients/:id/register-membership',  authenticateToken, clientController.registerClientMembership); // NUEVO



// Memberships
router.get("/plans", membershipController.getPlans);
router.post("/plans", membershipController.createPlan);
router.put("/plans/:id", membershipController.updatePlan);
router.delete("/plans/:id", membershipController.deletePlan);
router.post("/memberships/pay", membershipController.registerMembershipPayment);

router.post('/memberships/manual', membershipController.registerManualMembership);
router.post('/memberships/pay',    membershipController.registerMembershipPayment);

// Inventory
router.get("/products", inventoryController.getProducts);
router.post("/products", inventoryController.createProduct);
router.put("/products/:id", inventoryController.updateProduct);
router.delete("/products/:id", inventoryController.deleteProduct);

// Sales (POS)
router.get("/sales/today", salesController.getSalesToday);
router.get("/sales", salesController.getSales);
router.post("/sales", salesController.createSale);

// Reports
router.get("/reports/income", reportsController.getIncomeReport);
router.get("/reports/active-memberships", reportsController.getActiveMemberships);

// Settings — Admins
router.get("/settings/admins", getAdmins);
router.post("/settings/admins", createAdmin);
router.patch("/settings/admins/:id", updateAdmin);
router.patch("/settings/admins/:id/password", changePassword);
router.delete("/settings/admins/:id", deleteAdmin);

// Settings — Activity log
router.get("/settings/activity-log", getActivityLog);

export default router;
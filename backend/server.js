// backend/server.js
import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import apiRoutes from "./routes/api.js" 

dotenv.config()

const app = express()

// 🟡 Fix: CORS restringido al origen del frontend en producción.
// Antes: app.use(cors()) permitía cualquier origen — riesgo en producción.
// Agrega FRONTEND_URL=https://tu-dominio.com en .env; en desarrollo
// acepta localhost:5173 como fallback.
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:5173', 'http://localhost:3000'];

// Health check para Render
app.get('/health', (req, res) => res.status(200).json({ ok: true }));

app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origin (Postman, curl, apps móviles)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS bloqueado para origen: ${origin}`));
  },
  credentials: true,
}))

app.use(express.json())

// Ruta base
app.get("/", (req, res) => {
  res.send("🚀 XtremeGym API funcionando")
})

// Rutas
app.use("/", apiRoutes)


// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: "Error interno del servidor" })
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`🔥 Servidor corriendo en puerto ${PORT}`)
})
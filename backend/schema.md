# 📊 Esquema de Base de Datos - XTREMEGYM

## Descripción General
Este documento contiene la estructura completa de la base de datos para el sistema de gestión de gimnasio XTREMEGYM, extraída del análisis de los controladores del proyecto.

---

## 🗂️ Tablas

### 1. `users` - Clientes/Miembros
Almacena la información de los clientes del gimnasio.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  dni VARCHAR(20) UNIQUE,
  status VARCHAR(50) DEFAULT 'inactive' CHECK (status IN ('active', 'warning', 'expired', 'inactive')),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

**Campos:**
- `id`: Identificador único
- `full_name`: Nombre completo del cliente
- `phone`: Teléfono de contacto
- `email`: Correo electrónico
- `dni`: Documento nacional de identidad (único)
- `status`: Estado del cliente
  - `active`: Cliente activo con membresía vigente
  - `warning`: Cliente con membresía venciendo en 7 días o menos
  - `expired`: Cliente con membresía vencida
  - `inactive`: Cliente sin membresía
- `created_at`: Fecha de creación
- `updated_at`: Fecha de última actualización

---

### 2. `admins` - Administradores
Almacena la información de los administradores del sistema.

```sql
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT now()
);
```

**Campos:**
- `id`: Identificador único
- `username`: Nombre de usuario único
- `password_hash`: Contraseña hasheada con bcrypt
- `full_name`: Nombre completo del administrador
- `role`: Rol del administrador (default: 'admin')
- `created_at`: Fecha de creación

---

### 3. `membership_plans` - Planes de Membresía
Almacena los planes de membresía disponibles.

```sql
CREATE TABLE membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  duration_days INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

**Campos:**
- `id`: Identificador único
- `name`: Nombre del plan (ej: "Plan Básico", "Plan Premium")
- `price`: Precio del plan
- `duration_days`: Duración en días
- `description`: Descripción del plan
- `created_at`: Fecha de creación

---

### 4. `user_memberships` - Membresías de Usuarios
Asocia usuarios con planes de membresía y registra su período vigente.

```sql
CREATE TABLE user_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES membership_plans(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  created_at TIMESTAMP DEFAULT now()
);
```

**Campos:**
- `id`: Identificador único
- `user_id`: Referencia al usuario
- `plan_id`: Referencia al plan de membresía
- `start_date`: Fecha de inicio de la membresía (formato: YYYY-MM-DD)
- `end_date`: Fecha de fin de la membresía (formato: YYYY-MM-DD)
- `status`: Estado de la membresía
  - `active`: Membresía activa
  - `expired`: Membresía vencida
- `created_at`: Fecha de creación

**Notas:**
- Soporta múltiples membresías por usuario (extensiones/acumulaciones)
- Las membresías se calculan en zona horaria Colombia (UTC-5)

---

### 5. `payments` - Pagos
Registra todos los pagos realizados por los clientes.

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer')),
  payment_type VARCHAR(50) NOT NULL,
  reference_id UUID,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMP DEFAULT now()
);
```

**Campos:**
- `id`: Identificador único
- `user_id`: Referencia al usuario que realizó el pago
- `amount`: Monto del pago
- `payment_method`: Método de pago
  - `cash`: Efectivo
  - `card`: Tarjeta
  - `transfer`: Transferencia bancaria
- `payment_type`: Tipo de pago (ej: "membership", "product")
- `reference_id`: ID de referencia (ej: membership_id si es pago de membresía)
- `created_by`: ID del administrador que registró el pago
- `created_at`: Fecha del pago

---

### 6. `check_ins` - Check-ins/Asistencias
Registra cada asistencia de los clientes al gimnasio.

```sql
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50),
  created_at TIMESTAMP DEFAULT now()
);
```

**Campos:**
- `id`: Identificador único
- `user_id`: Referencia al usuario
- `type`: Tipo de check-in
- `created_at`: Fecha y hora del check-in

---

### 7. `inventory` - Inventario
Almacena los productos en inventario (suplementos, equipos, etc.).

```sql
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

**Campos:**
- `id`: Identificador único
- `name`: Nombre del producto
- `quantity`: Cantidad disponible
- `created_at`: Fecha de creación
- `updated_at`: Fecha de última actualización

---

### 8. `sales` - Ventas
Registra las ventas de productos del inventario.

```sql
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES inventory(id),
  quantity_sold INTEGER NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMP DEFAULT now()
);
```

**Campos:**
- `id`: Identificador único
- `item_id`: Referencia al producto vendido
- `quantity_sold`: Cantidad vendida
- `amount`: Monto total de la venta
- `created_by`: ID del administrador que registró la venta
- `created_at`: Fecha de la venta

---

### 9. `settings` - Configuración
Almacena configuraciones generales del sistema.

```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

**Campos:**
- `id`: Identificador único
- `key`: Clave de configuración (única)
- `value`: Valor de la configuración
- `created_at`: Fecha de creación
- `updated_at`: Fecha de última actualización

---

## 📑 Índices para Optimización

```sql
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_dni ON users(dni);
CREATE INDEX idx_user_memberships_user_id ON user_memberships(user_id);
CREATE INDEX idx_user_memberships_status ON user_memberships(status);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_check_ins_user_id ON check_ins(user_id);
CREATE INDEX idx_check_ins_created_at ON check_ins(created_at);
```

---

## 🔗 Relaciones

```
users (1) ──→ (N) user_memberships
users (1) ──→ (N) payments
users (1) ──→ (N) check_ins
admins (1) ──→ (N) payments
admins (1) ──→ (N) sales
membership_plans (1) ──→ (N) user_memberships
inventory (1) ──→ (N) sales
```

---

## ⏰ Notas Importantes

1. **Zona Horaria**: El sistema utiliza zona horaria de Colombia (UTC-5) para todas las operaciones de fecha.
2. **Membresías Múltiples**: Un usuario puede tener múltiples membresías activas si están acumuladas (extensiones).
3. **Estados de Usuario**: El estado `warning` se asigna automáticamente cuando una membresía tiene 7 días o menos para vencer.
4. **Soft Delete**: Las membresías no se eliminan, sino que se marcan como `expired`.
5. **Cascada**: Al eliminar un usuario, se eliminan automáticamente sus membresías, pagos y check-ins.

---

## 🛠️ Implementación

### Opción 1: PostgreSQL Local
```bash
psql -U usuario -d xtremegym -f schema.sql
```

### Opción 2: Supabase
1. Crear nueva instancia de Supabase
2. Copiar el SQL en el SQL Editor
3. Ejecutar

### Opción 3: Usar db.js con cliente PostgreSQL
Actualizar `db.js` para usar `pg` o `sequelize` en lugar de Supabase.

---

**Última actualización**: 2026-06-02
**Generado desde análisis de controladores del proyecto**

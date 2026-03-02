// backend/controllers/salesController.js
import { supabase } from '../db.js';

export const createSale = async (req, res) => {
  const { user_id, items, total_amount, discount, payment_method } = req.body;
  const admin_id = req.user?.id;

  if (!items || items.length === 0)
    return res.status(400).json({ error: 'La venta debe tener al menos un producto.' });
  if (total_amount === undefined || total_amount < 0)
    return res.status(400).json({ error: 'total_amount inválido.' });
  if (!['cash', 'card', 'transfer'].includes(payment_method))
    return res.status(400).json({ error: 'payment_method debe ser "cash", "card" o "transfer".' });

  try {
    // 1. Verificar stock disponible para todos los ítems antes de crear nada
    for (const item of items) {
      const { data: product, error: stockError } = await supabase
        .from('products').select('stock, name').eq('id', item.product_id).single();
      if (stockError || !product)
        throw new Error(`Producto ${item.product_id} no encontrado.`);
      if (product.stock < item.quantity)
        throw new Error(
          `Stock insuficiente para "${product.name}". Disponible: ${product.stock}, solicitado: ${item.quantity}.`
        );
    }

    // 2. Crear registro de venta
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([{
        user_id:       user_id ?? null,
        total_amount:  Number(total_amount),
        discount:      Number(discount ?? 0),
        payment_method,
        created_by:    admin_id ?? null,
      }])
      .select().single();
    if (saleError) throw saleError;

    // 3. Insertar detalle de venta
    const details = items.map((item) => ({
      sale_id:    sale.id,
      product_id: item.product_id,
      quantity:   Number(item.quantity),
      unit_price: Number(item.unit_price),
      subtotal:   Number(item.quantity) * Number(item.unit_price),
    }));
    const { error: detailsError } = await supabase.from('sale_details').insert(details);
    if (detailsError) throw detailsError;

    // 4. Decremento atómico de stock via RPC
    // La función SQL garantiza que stock >= qty antes de restar (sin race condition).
    // Crear en Supabase → SQL Editor:
    //
    //   CREATE OR REPLACE FUNCTION decrement_stock(p_id uuid, qty int)
    //   RETURNS void LANGUAGE plpgsql AS $$
    //   BEGIN
    //     UPDATE products SET stock = stock - qty
    //     WHERE id = p_id AND stock >= qty;
    //     IF NOT FOUND THEN
    //       RAISE EXCEPTION 'Stock insuficiente para producto %', p_id;
    //     END IF;
    //   END $$;
    //
    for (const item of items) {
      const { error: rpcError } = await supabase.rpc('decrement_stock', {
        p_id: item.product_id,
        qty:  Number(item.quantity),
      });

      if (rpcError) {
        // Rollback manual: borrar detalles y venta
        await supabase.from('sale_details').delete().eq('sale_id', sale.id);
        await supabase.from('sales').delete().eq('id', sale.id);
        throw new Error(
          rpcError.message.includes('insuficiente')
            ? rpcError.message
            : `Error al actualizar stock: ${rpcError.message}`
        );
      }
    }

    // 5. Crear registro de pago
    const { error: paymentError } = await supabase.from('payments').insert([{
      user_id:       user_id ?? null,
      amount:        Number(total_amount),
      payment_method,
      payment_type:  'product_sale',
      reference_id:  sale.id,
      created_by:    admin_id ?? null,
    }]);
    if (paymentError) console.error('Aviso: pago no registrado:', paymentError.message);

    res.status(201).json(sale);
  } catch (err) {
    console.error('Error creando venta:', err.message);
    res.status(400).json({ error: err.message });
  }
};

export const getSales = async (req, res) => {
  const { data, error } = await supabase
    .from('sales')
    .select('*, users(full_name), sale_details(*, products(name))')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

// Timezone Colombia (UTC-5): ventas del día actual en hora local
export const getSalesToday = async (req, res) => {
  const COL_OFFSET_MS = 5 * 3_600_000;
  const todayStr   = new Date(Date.now() - COL_OFFSET_MS).toISOString().slice(0, 10);
  const todayStart = `${todayStr}T05:00:00.000Z`; // 00:00 Colombia = 05:00 UTC

  const { data, error } = await supabase
    .from('sales')
    .select('*, users(full_name), sale_details(*, products(name))')
    .gte('created_at', todayStart)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};
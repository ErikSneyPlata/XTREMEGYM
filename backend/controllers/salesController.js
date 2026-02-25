import { supabase } from '../db.js';

export const createSale = async (req, res) => {
  const { user_id, items, total_amount, discount, payment_method } = req.body;
  const admin_id = req.user?.id;

  try {
    // 1. Create Sale record
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([{ 
        user_id, 
        total_amount, 
        discount, 
        payment_method, 
        created_by: admin_id 
      }])
      .select()
      .single();

    if (saleError) throw saleError;

    // 2. Create Sale Details and update stock
    const details = items.map((item) => ({
      sale_id: sale.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.quantity * item.unit_price
    }));

    const { error: detailsError } = await supabase
      .from('sale_details')
      .insert(details);

    if (detailsError) throw detailsError;

    // 3. Update stock for each product
    for (const item of items) {
      const { data: product } = await supabase
        .from('products')
        .select('stock')
        .eq('id', item.product_id)
        .single();
      
      if (product) {
        await supabase
          .from('products')
          .update({ stock: product.stock - item.quantity })
          .eq('id', item.product_id);
      }
    }

    // 4. Create payment record
    await supabase.from('payments').insert([{
      user_id,
      amount: total_amount,
      payment_method,
      payment_type: 'product_sale',
      reference_id: sale.id,
      created_by: admin_id
    }]);

    res.status(201).json(sale);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getSales = async (req, res) => {
  const { data, error } = await supabase
    .from('sales')
    .select('*, users(full_name), sale_details(*, products(name))')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

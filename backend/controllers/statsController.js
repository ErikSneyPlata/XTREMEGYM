import { supabase } from '../db.js';

export const registerCheckIn = async (req, res) => {
  const { user_id, type, payment_amount, payment_method } = req.body;
  const admin_id = req.user?.id;

  try {
    let payment_id = null;

    // If it's a daily pass, we need to record a payment
    if (type === 'daily') {
      const { data: payment, error: payError } = await supabase
        .from('payments')
        .insert([{
          user_id,
          amount: payment_amount,
          payment_method,
          payment_type: 'daily_pass',
          created_by: admin_id
        }])
        .select()
        .single();

      if (payError) throw payError;
      payment_id = payment.id;
    }

    // Register check-in
    const { data: checkin, error: checkError } = await supabase
      .from('check_ins')
      .insert([{
        user_id,
        payment_id,
        type,
        created_by: admin_id
      }])
      .select()
      .single();

    if (checkError) throw checkError;

    // Update user last check-in
    await supabase
      .from('users')
      .update({ last_check_in: new Date().toISOString() })
      .eq('id', user_id);

    res.status(201).json(checkin);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getDashboardStats = async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  try {
    // 1. Daily Income
    const { data: dailyPayments } = await supabase
      .from('payments')
      .select('amount')
      .gte('created_at', todayISO);
    
    const dailyIncome = dailyPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    // 2. Monthly Income (Current month)
    const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const { data: monthlyPayments } = await supabase
      .from('payments')
      .select('amount')
      .gte('created_at', firstDayMonth);
    
    const monthlyIncome = monthlyPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    // 3. Active Memberships
    const { count: activeMemberships } = await supabase
      .from('user_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // 4. Low Stock Products
    const { data: products } = await supabase
      .from('products')
      .select('*');
    
    const lowStockCount = products?.filter(p => p.stock <= p.min_stock).length || 0;

    // 5. Check-ins today
    const { count: checkinsToday } = await supabase
      .from('check_ins')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayISO);

    res.json({
      dailyIncome,
      monthlyIncome,
      activeMemberships,
      lowStockCount,
      checkinsToday
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

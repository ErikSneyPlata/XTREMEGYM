import { supabase } from '../db.js';

export const getPlans = async (req, res) => {
  const { data, error } = await supabase.from('membership_plans').select('*');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

export const registerMembershipPayment = async (req, res) => {
  const { user_id, plan_id, payment_method, start_date } = req.body;
  const admin_id = req.user?.id;

  try {
    // 1. Get plan details
    const { data: plan, error: planError } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('id', plan_id)
      .single();

    if (planError) throw planError;

    // 2. Calculate end date
    const startDate = new Date(start_date || new Date());
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + plan.duration_days);

    // 3. Deactivate previous memberships for this user
    await supabase
      .from('user_memberships')
      .update({ status: 'expired' })
      .eq('user_id', user_id)
      .eq('status', 'active');

    // 4. Create new membership
    const { data: membership, error: memError } = await supabase
      .from('user_memberships')
      .insert([{
        user_id,
        plan_id,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        status: 'active'
      }])
      .select()
      .single();

    if (memError) throw memError;

    // 5. Create payment record
    await supabase.from('payments').insert([{
      user_id,
      amount: plan.price,
      payment_method,
      payment_type: 'membership',
      reference_id: membership.id,
      created_by: admin_id
    }]);

    // 6. Update user status
    await supabase
      .from('users')
      .update({ status: 'active' })
      .eq('id', user_id);

    res.status(201).json(membership);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

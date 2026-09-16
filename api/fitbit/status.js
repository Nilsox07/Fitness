import { admin, userFromAuth } from '../_fitbit.js'

export default async function handler(req, res) {
  const configured = Boolean(process.env.FITBIT_CLIENT_ID)
  const user = await userFromAuth(req)
  if (!user) {
    res.status(200).json({ connected: false, configured })
    return
  }
  const { data } = await admin()
    .from('fitbit_tokens')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()
  res.status(200).json({ connected: Boolean(data), configured })
}

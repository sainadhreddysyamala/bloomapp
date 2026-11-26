const env = require('../config/env');
const Worker = require('../models/Worker');
const { z } = require('zod');
const parseSchema = z.object({ transcript: z.string().trim().min(1).max(5000), language: z.string().trim().max(20).default('en-IN'), businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
exports.parseVoice = async (req, res, next) => {
  try {
    const input = parseSchema.parse(req.body);
    if (!env.AI_API_KEY) return res.status(503).json({ message: 'AI voice parsing is not configured. You can still use the manual entry form.', code: 'AI_NOT_CONFIGURED' });
    const workerFilter = req.user.role === 'admin' ? { isActive: true } : (req.user.worker ? { _id: req.user.worker._id || req.user.worker, isActive: true } : { _id: null });
    const allowedWorkers = await Worker.find(workerFilter).select('workerCode fullName').lean();
    if (!allowedWorkers.length) return res.status(400).json({ message: 'No linked workers are available to parse. Ask an administrator to create or link a worker profile.' });
    const roster = allowedWorkers.map(w => `${w.workerCode} = ${w.fullName}`).join('; ');
    const prompt = `You parse flower-worker daily records. Return only JSON with shape {"entries":[{"workerCode":"","attendance":"present|absent","morga":0,"jasmine":0,"unit":"kg","notes":""}]}. User language/locale: ${input.language}. Business date: ${input.businessDate}. Allowed workers (use only these exact codes): ${roster}. Match a spoken name to this roster only when unambiguous. IMPORTANT LOCAL FLOWER MAPPING for this business: Morga/mogra column means మల్లెపూలు (Mallepoolu). Jasmine column means జాజులు (Jajulu). When the transcript says మల్లెపూలు or Mallepoolu, put its quantity in morga. When it says జాజులు or Jajulu, put its quantity in jasmine. Do NOT swap these columns. Other generic words such as jasmine/malli/malle should only be mapped when the transcript makes the intended column clear; otherwise return no entries and ask a clarification. Extract quantities exactly. Never invent worker codes or quantities. If unclear, return {"entries":[],"clarification":"..."}. Transcript: ${input.transcript}`;
    const base = env.AI_BASE_URL.replace(/\/+$/, '');
    const response = await fetch(`${base}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.AI_API_KEY}` }, body: JSON.stringify({ model: env.AI_MODEL, temperature: 0, messages: [{ role: 'system', content: 'You extract structured data and must not invent facts. Return JSON only.' }, { role: 'user', content: prompt }], response_format: { type: 'json_object' } }) });
    if (!response.ok) { const msg = await response.text(); console.error('AI provider error', response.status, msg.slice(0, 400)); return res.status(502).json({ message: 'AI service request failed. Check AI_API_KEY, AI_MODEL and AI_BASE_URL.' }); }
    const body = await response.json(); const content = body.choices?.[0]?.message?.content;
    if (!content) return res.status(502).json({ message: 'AI returned an empty response. Please use manual entry.' });
    let parsed; try { parsed = JSON.parse(content); } catch { return res.status(502).json({ message: 'AI response was not valid JSON. Please use manual entry.' }); }
    const validEntries = Array.isArray(parsed.entries) ? parsed.entries.filter(e => e && typeof e.workerCode === 'string' && ['present','absent'].includes(e.attendance) && Number.isFinite(Number(e.morga)) && Number.isFinite(Number(e.jasmine)) && Number(e.morga) >= 0 && Number(e.jasmine) >= 0).map(e => ({ workerCode: e.workerCode.trim().toUpperCase(), attendance: e.attendance, morga: e.attendance === 'absent' ? 0 : Number(e.morga), jasmine: e.attendance === 'absent' ? 0 : Number(e.jasmine), unit: String(e.unit || 'kg').slice(0,20), notes: String(e.notes || '').slice(0,1000) })) : [];
    res.json({ entries: validEntries, clarification: typeof parsed.clarification === 'string' ? parsed.clarification : '', requiresReview: true });
  } catch (e) { next(e); }
};

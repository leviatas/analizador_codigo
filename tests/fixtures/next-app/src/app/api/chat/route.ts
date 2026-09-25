import OpenAI from 'openai'
import { streamText } from 'ai'
import _ from 'lodash'
import { exec } from 'child_process'
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
export async function POST(req: Request) {
  const body = await req.json()
  exec(`convert ${body.file}`)
  const res = await client.chat.completions.create({ model: 'gpt-4o', messages: [{ role: 'system', content: 'hi' }] })
  return Response.json(res)
}
export async function GET() { return Response.json({ ok: true }) }

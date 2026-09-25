'use client'
import OpenAI from 'openai'
import { create } from 'zustand'
import dayjs from 'dayjs'
const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY
const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true })
export const useChatStore = create(() => ({}))
export function Chat() { return <div>chat</div> }

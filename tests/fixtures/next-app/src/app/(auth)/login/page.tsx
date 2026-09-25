'use client'
import { useState } from 'react'
import axios from 'axios'
export default function Login() {
  const [token, setToken] = useState('')
  localStorage.setItem('authToken', token)
  const x = eval('1+1')
  return <form><input type="password" /></form>
}

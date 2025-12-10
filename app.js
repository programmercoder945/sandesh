import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import * as crypto from './crypto.js'

// ----- Supabase Setup -----
const supabaseUrl = 'https://oxbdctocjpvtrdgoacpe.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94YmRjdG9janB2dHJkZ29hY3BlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyOTIwMzEsImV4cCI6MjA4MDg2ODAzMX0.48UmOXbkXpLaKuvhnWWp_1i9J8-0wvQl-Ppmz-e9tKA'
const supabase = createClient(supabaseUrl, supabaseKey)

// ----- Global Variables -----
let currentUser = null
let currentChatId = null
let aesKey = null

// ----- DOM Elements -----
const loginDiv = document.getElementById('login')
const mainUI = document.getElementById('main-ui')
const loginBtn = document.getElementById('login-btn')
const contactsList = document.getElementById('contacts-list')
const channelsList = document.getElementById('channels-list')
const messagesDiv = document.getElementById('messages')
const newMessage = document.getElementById('new-message')
const sendBtn = document.getElementById('send-btn')

// ----- Login / Signup -----
loginBtn.onclick = async () => {
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  if(!email || !password) return alert("Email & password required")

  // Try sign in
  let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

  if(signInError || !signInData.user){
    // Sign up if sign-in fails
    let { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
    if(signUpError) return alert("Signup failed: " + signUpError.message)
    currentUser = signUpData.user
  } else {
    currentUser = signInData.user
  }

  // Ensure profile exists
  await supabase.from('profiles').upsert({ id: currentUser.id, name: email.split('@')[0], last_seen: new Date().toISOString() })

  loginDiv.style.display = 'none'
  mainUI.style.display = 'block'
  aesKey = await crypto.generateAESKey()

  await loadContacts()
  await loadChannels()
}

// ----- Load contacts (other users) -----
async function loadContacts(){
  const { data: users } = await supabase.from('profiles').select('*').neq('id', currentUser.id)
  contactsList.innerHTML = ''
  users.forEach(u => {
    const btn = document.createElement('button')
    btn.textContent = u.name || u.id
    btn.onclick = () => openChatWith(u.id)
    contactsList.appendChild(btn)
  })
}

// ----- Load channels/groups -----
async function loadChannels(){
  const { data: channels } = await supabase.from('channels').select('*')
  channelsList.innerHTML = ''
  channels.forEach(ch => {
    const btn = document.createElement('button')
    btn.textContent = ch.title
    btn.onclick = () => openChannel(ch.id)
    channelsList.appendChild(btn)
  })
}

// ----- Open 1-1 chat -----
async function openChatWith(otherUserId){
  // Check existing chat
  const { data: chats } = await supabase.from('chats').select('*').contains('members',[currentUser.id, otherUserId])
  let chat = chats?.[0]
  if(!chat){
    const { data: newChat } = await supabase.from('chats').insert([{ is_group:false, members:[currentUser.id, otherUserId] }])
    chat = newChat[0]
  }
  currentChatId = chat.id
  messagesDiv.innerHTML = ''
  subscribeMessages(currentChatId)
}

// ----- Open channel -----
async function openChannel(channelId){
  currentChatId = channelId
  messagesDiv.innerHTML = ''
  subscribeMessages(currentChatId, true)
}

// ----- Subscribe to messages -----
function subscribeMessages(chatId, isChannel=false){
  const table = isChannel ? 'channel_messages' : 'messages'
  supabase.from(`${table}:chat_id=eq.${chatId}`).on('INSERT', payload => displayMessage(payload.new)).subscribe()

  loadMessages(chatId, isChannel)
}

// ----- Load existing messages -----
async function loadMessages(chatId, isChannel=false){
  const table = isChannel ? 'channel_messages' : 'messages'
  const { data: msgs } = await supabase.from(table).select('*').eq('chat_id', chatId)
  msgs.forEach(displayMessage)
}

// ----- Display message -----
async function displayMessage(msg){
  let content = msg.content
  if(msg.encrypted){
    const encData = new Uint8Array(atob(msg.content).split("").map(c=>c.charCodeAt(0)))
    const iv = new Uint8Array(msg.metadata?.iv || [])
    content = await crypto.decryptAES(aesKey, encData.buffer, iv)
  }

  const div = document.createElement('div')
  div.innerHTML = crypto.parseMessage(content)
  messagesDiv.appendChild(div)
  messagesDiv.scrollTop = messagesDiv.scrollHeight
}

// ----- Send message -----
sendBtn.onclick = async () => {
  if(!currentChatId) return
  const rawContent = newMessage.value
  if(!rawContent) return

  const { encData, iv } = await crypto.encryptAES(aesKey, rawContent)
  const encBase64 = btoa(String.fromCharCode(...new Uint8Array(encData)))

  await supabase.from(currentChatId.includes('-')?'messages':'channel_messages').insert([{
    chat_id: currentChatId,
    sender: currentUser.id,
    content: encBase64,
    metadata: { iv: Array.from(iv) },
    encrypted: true
  }])

  newMessage.value = ''
}

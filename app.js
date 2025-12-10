import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import * as crypto from './crypto.js'

const supabaseUrl = 'https://oxbdctocjpvtrdgoacpe.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94YmRjdG9janB2dHJkZ29hY3BlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyOTIwMzEsImV4cCI6MjA4MDg2ODAzMX0.48UmOXbkXpLaKuvhnWWp_1i9J8-0wvQl-Ppmz-e9tKA'
const supabase = createClient(supabaseUrl, supabaseKey)

let currentUser = null
let currentChatId = null
let aesKey = null

const loginBtn = document.getElementById('login-btn')
const chatUI = document.getElementById('chat-ui')
const loginDiv = document.getElementById('login')
const messagesDiv = document.getElementById('messages')
const sendBtn = document.getElementById('send-btn')
const newMessage = document.getElementById('new-message')
const contactsList = document.getElementById('contacts-list')

// Login/signup
loginBtn.onclick = async () => {
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value

  if(!email || !password){ 
    alert("Enter email and password"); 
    return 
  }

  let currentUser = null

  // Try signing in
  let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  
  if(signInError || !signInData.user){
    // If sign in fails, try signing up
    let { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
    if(signUpError){ 
      alert("Signup failed: " + signUpError.message)
      return
    }
    currentUser = signUpData.user
  } else {
    currentUser = signInData.user
  }

  if(!currentUser){
    alert("Login failed")
    return
  }

  // Insert profile if not exists
  await supabase.from('profiles').upsert({
    id: currentUser.id,
    name: email.split('@')[0],
    last_seen: new Date().toISOString()
  })

  // Hide login UI, show chat UI
  loginDiv.style.display = 'none'
  chatUI.style.display = 'block'

  // Generate per-user AES key (for E2EE skeleton)
  aesKey = await crypto.generateAESKey()

  // Load contacts immediately
  loadContacts()
}

// Load other users as contacts
async function loadContacts() {
  const { data: users } = await supabase.from('profiles').select('*').neq('id', currentUser.id)
  contactsList.innerHTML = ''
  users.forEach(u => {
    const btn = document.createElement('button')
    btn.textContent = u.name || u.id
    btn.onclick = () => openChatWith(u.id)
    contactsList.appendChild(btn)
  })
}

// Open 1-1 chat
async function openChatWith(otherUserId) {
  // Check if chat exists
  let { data: chats } = await supabase.from('chats').select('*').contains('members', [currentUser.id, otherUserId])
  let chat = chats[0]
  if(!chat){
    const { data } = await supabase.from('chats').insert([{ is_group:false, members:[currentUser.id, otherUserId] }])
    chat = data[0]
  }
  currentChatId = chat.id
  messagesDiv.innerHTML = ''
  subscribeMessages(currentChatId)
}

// Subscribe to realtime messages
function subscribeMessages(chatId){
  supabase.from(`messages:chat_id=eq.${chatId}`).on('INSERT', payload => {
    displayMessage(payload.new)
  }).subscribe()

  loadMessages(chatId)
}

// Load existing messages
async function loadMessages(chatId){
  const { data: msgs } = await supabase.from('messages').select('*').eq('chat_id', chatId)
  msgs.forEach(displayMessage)
}

// Display message
function displayMessage(msg){
  const div = document.createElement('div')
  div.textContent = crypto.parseMessage(msg.content)
  messagesDiv.appendChild(div)
  messagesDiv.scrollTop = messagesDiv.scrollHeight
}

// Send message
sendBtn.onclick = async () => {
  if(!currentChatId) return
  const content = newMessage.value // replace with AES encryption
  await supabase.from('messages').insert([{ chat_id: currentChatId, sender: currentUser.id, content }])
  newMessage.value = ''
}

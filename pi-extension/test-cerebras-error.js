import fs from 'node:fs'

const data = JSON.parse(fs.readFileSync('/Users/vava/Documents/GitHub/free-coding-models/pi-extension/request-params.json', 'utf8'))
const { params } = data

// Force stream: false so we get the full response body easily
params.stream = false

console.log('Sending request to Cerebras...')
const resp = await fetch('https://api.cerebras.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer csk-cm84r5nv3cvpe4nnxymm5ndt42r6ck8dfkev36d8fvh8839c'
  },
  body: JSON.stringify(params)
})

console.log('Status:', resp.status)
const text = await resp.text()
console.log('Response:', text)

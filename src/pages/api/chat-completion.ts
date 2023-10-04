import { Message } from '@/models'

export const config = {
  runtime: 'edge'
}

const handler = async (req: Request): Promise<Response> => {
  try {
    const { messages } = (await req.json()) as {
      messages: Message[]
    }

    const charLimit = 12000
    let charCount = 0
    let messagesToSend = []

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]
      if (charCount + message.content.length > charLimit) {
        break
      }
      charCount += message.content.length
      messagesToSend.push(message)
    }

    let apiUrl: string
    let apiBaseUrl = process.env.CHATBOT_API_BASE_URL
      if (apiBaseUrl && apiBaseUrl.endsWith('/')) {
        apiBaseUrl = apiBaseUrl.slice(0, -1)
      }
      apiUrl = `${apiBaseUrl}` 
    const stream = await ChatbotStream(apiUrl, messagesToSend)

    return new Response(stream)
  } catch (error) {
    console.error(error)
    return new Response('Error', { status: 500 })
  }
}

const ChatbotStream = async (apiUrl: string, messages: Message[]) => {
  const encoder = new TextEncoder()
  const res = await fetch(apiUrl, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify({
      messages: messages
    })
  })
  console.log(messages);
  if (res.status !== 200) {
    const statusText = res.statusText
    throw new Error(
      `The Chatbot API has encountered an error with a status code of ${res.status} and message ${statusText}`
    )
  }

  return new ReadableStream({
    async start(controller) {
      try {
        const response = await fetch(apiUrl);
  
        if (!response.ok) {
          throw new Error(`Failed to fetch content from Flask app: ${response.statusText}`);
        }
  
        // Read the response content
        const content = await response.text();

        // Encode the custom reply if necessary
        const content_formatted = content.replace('\n', ' ');
        const string_sliced = content_formatted.slice(1, -2);
        // console.log(string_sliced)
        const encodedReply = encoder.encode(string_sliced);

        // Enqueue the custom reply
        controller.enqueue(encodedReply);
        // Signal the end of the stream
        controller.close();

      } catch (error) {
        console.error(error);
        // You can handle errors here if needed
        return new ReadableStream({
          start(controller) {
            controller.error(error);
        }
        });
        }
    }
  });
}
export default handler

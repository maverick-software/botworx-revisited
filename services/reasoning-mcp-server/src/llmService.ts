import axios, { AxiosError } from 'axios';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: {
    message: OpenAIChatMessage;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message: string;
    type: string;
    param: string | null;
    code: string | null;
  };
}

/**
 * Calls the OpenAI Chat Completions API with a given prompt.
 * @param prompt The user prompt to send to OpenAI.
 * @param systemPrompt An optional system prompt to guide the assistant's behavior.
 * @param model The OpenAI model to use (e.g., "gpt-3.5-turbo").
 * @returns The content of the assistant's response.
 * @throws Error if API key is missing or if the API call fails.
 */
export async function callOpenAI(
  prompt: string,
  systemPrompt?: string | null,
  model: string = "gpt-3.5-turbo"
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('[LLMService] OpenAI API key (OPENAI_API_KEY) is not set in environment variables.');
    throw new Error('OpenAI API key is missing. Please set OPENAI_API_KEY environment variable.');
  }

  const messages: OpenAIChatMessage[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  console.log(`[LLMService] Calling OpenAI API. Model: ${model}. System prompt: ${systemPrompt ? 'Yes' : 'No'}. User prompt starts with: "${prompt.substring(0, 50)}..."`);

  try {
    const response = await axios.post<OpenAIResponse>(
      OPENAI_API_URL,
      {
        model: model,
        messages: messages,
        temperature: 0.7, // Default temperature, can be made a parameter
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 seconds timeout, can be made configurable
      }
    );

    if (response.data.error) {
      console.error('[LLMService] OpenAI API Error:', response.data.error);
      throw new Error(`OpenAI API Error: ${response.data.error.message}`);
    }

    if (response.data.choices && response.data.choices.length > 0 && response.data.choices[0].message) {
      const assistantResponse = response.data.choices[0].message.content;
      console.log(`[LLMService] OpenAI API call successful. Response starts with: "${assistantResponse.substring(0, 100)}..."`);
      if (response.data.usage) {
        console.log(`[LLMService] Token usage: Prompt: ${response.data.usage.prompt_tokens}, Completion: ${response.data.usage.completion_tokens}, Total: ${response.data.usage.total_tokens}`);
      }
      return assistantResponse;
    } else {
      console.error('[LLMService] OpenAI API response does not contain expected data (choices or message).', response.data);
      throw new Error('Invalid response structure from OpenAI API.');
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<OpenAIResponse>; // Type assertion
      console.error('[LLMService] Axios error calling OpenAI API:', axiosError.message);
      if (axiosError.response) {
        console.error('[LLMService] OpenAI API Error Response Status:', axiosError.response.status);
        console.error('[LLMService] OpenAI API Error Response Data:', axiosError.response.data);
        if (axiosError.response.data?.error) {
            throw new Error(`OpenAI API Error (${axiosError.response.status}): ${axiosError.response.data.error.message}`);
        }
        throw new Error(`OpenAI API request failed with status ${axiosError.response.status}`);
      }
    } else {
      console.error('[LLMService] Generic error calling OpenAI API:', error);
    }
    // Re-throw the original error or a more specific one if preferred
    throw error; // Or new Error('Failed to communicate with OpenAI API.');
  }
} 
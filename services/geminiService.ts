
import { GoogleGenAI, Type, Modality } from "@google/genai";

// Use process.env.API_KEY directly as per guidelines. 
// A new instance should be created right before making an API call.
export const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Local Inference Support (AirLLM / Ollama / LocalAI compatible)
 */
export const getLocalAiResponse = async (prompt: string, endpoint: string = "http://localhost:11434/v1/chat/completions") => {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "llama3", // Default for free Llamas
        messages: [{ role: "user", content: prompt }],
        stream: false
      })
    });
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Local AirLLM Error:", error);
    return "Local Cluster Error: AirLLM node unreachable. Ensure your local Pi inference worker is active.";
  }
};

/**
 * Advanced Multi-Modal AI Interface
 */
export const getAiResponse = async (prompt: string, options: { 
  context?: any, 
  mode: 'fast' | 'complex' | 'thinking' | 'maps',
  provider?: 'gemini' | 'airllm',
  localEndpoint?: string,
  media?: { data: string, mimeType: string }[]
}) => {
  // Route to local AirLLM if selected
  if (options.provider === 'airllm') {
    return getLocalAiResponse(prompt, options.localEndpoint);
  }

  const ai = getAiClient();
  let model = 'gemini-3-flash-preview'; 
  
  // Construct a dynamic system instruction based on the passed context
  const contextStr = JSON.stringify(options.context || {});
  const nodeCount = options.context?.cluster?.length || 1;
  
  const config: any = {
    temperature: 0.7,
    systemInstruction: `You are PiNet AI, the master intelligence for Web3PiOS. 
    Operating on a ${nodeCount}-node Raspberry Pi 5 cluster.
    
    Current Telemetry Context: ${contextStr}.
    
    Capabilities:
    1. Multi-Pi Cluster Provisioning (Master, Sense, Storage nodes).
    2. M.402 Agentic Payment Protocol awareness.
    3. Hardware Hat management (NPU, Sense, NVMe).
    4. Vision-based hardware diagnostics.
    5. Thinking Mode: Advanced architectural reasoning for complex queries.`
  };

  if (options.mode === 'complex' || (options.media && options.media.length > 0)) {
    model = 'gemini-3-pro-preview';
  } else if (options.mode === 'thinking') {
    model = 'gemini-3-pro-preview';
    config.thinkingConfig = { thinkingBudget: 32768 };
  } else if (options.mode === 'maps') {
    model = 'gemini-2.5-flash';
    config.tools = [{ googleMaps: {} }];
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
      config.toolConfig = {
        retrievalConfig: {
          latLng: { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
        }
      };
    } catch (e) { }
  }

  try {
    const parts: any[] = [{ text: prompt }];
    if (options.media) {
      options.media.forEach(m => {
        parts.push({ inlineData: m });
      });
    }

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config
    });

    let text = response.text || "";
    
    if (options.mode === 'maps' && response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      const links = response.candidates[0].groundingMetadata.groundingChunks
        .map((chunk: any) => chunk.maps?.uri || chunk.web?.uri)
        .filter(Boolean);
      if (links.length > 0) {
        text += "\n\n**Grounding Sources:**\n" + links.map((l: string) => `- [Open Map Resource](${l})`).join('\n');
      }
    }

    return text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Neural uplink timeout. Check your project API configuration.";
  }
};

export const generateClusterAssets = async (prompt: string) => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: `High-fidelity Web3PiOS interface mockup: ${prompt}` }] },
      config: {
        imageConfig: { aspectRatio: "16:9", imageSize: "1K" }
      }
    });

    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Image Generation Error:", error);
    return null;
  }
};

export const generateVeoVideo = async (prompt: string, orientation: '16:9' | '9:16' = '16:9') => {
  const ai = getAiClient();
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `Web3PiOS futuristic UI transition: ${prompt}`,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: orientation
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 8000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Veo Video Error:", error);
    return null;
  }
};

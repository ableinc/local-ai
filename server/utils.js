import { execSync } from 'node:child_process';

export async function installOllamaEmbeddingModelIfNeeded() {
  const modelName = process.env.VITE_EMBEDDING_MODEL_NAME || 'nomic-embed-text';
  try {
    const response = await fetch(`${process.env.VITE_OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      console.error('Failed to fetch Ollama models');
      return false;
    }
    const models = await response.json();
    const modelInstalled = models.models.some(model => model.name.includes(modelName));
    if (!modelInstalled) {
      console.log(`Ollama model "${modelName}" not found. Installing...`);
      execSync(`ollama pull ${modelName}`, { stdio: 'inherit' });
      console.log(`Ollama model "${modelName}" installed successfully.`);
    } else {
      console.log(`Ollama model "${modelName}" is already installed.`);
    }
  } catch (error) {
    console.error('Error checking/installing Ollama model:', error);
    return false;
  }
  return true;
}
"""
Servicio para comunicación con Ollama (LLM local).
"""
import requests
from typing import List, Dict, Any
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class LLMService:
    """
    Wrapper para llamar a Ollama API local.
    
    Ollama debe estar corriendo en el puerto 11434 (por defecto).
    Modelos recomendados:
    - llama3.2:3b (rápido, ligero, 3B parámetros)
    - llama3.1:8b (mejor calidad, 8B parámetros)
    - mistral:7b (alternativa, buena en español)
    """
    
    def __init__(self):
        self.ollama_url = settings.OLLAMA_URL
        self.model = settings.OLLAMA_MODEL
        self.timeout = settings.OLLAMA_TIMEOUT
        self.max_tokens = settings.CHATBOT_MAX_TOKENS
        self.temperature = settings.CHATBOT_TEMPERATURE
    
    def generate_response(
        self, 
        messages: List[Dict[str, str]], 
        temperature: float = None,
        max_tokens: int = None,
        stream: bool = False
    ) -> Dict[str, Any]:
        """
        Genera respuesta del LLM usando Ollama.
        
        Args:
            messages: Lista de mensajes [{"role": "system", "content": "..."}, ...]
            temperature: Creatividad (0-1). None usa el default
            max_tokens: Límite de tokens de respuesta. None usa el default
            stream: Si True, retorna generador para streaming (usado en SSE)
        
        Returns:
            Si stream=False: {
                'content': str,
                'tokens_used': int,
                'finish_reason': str,
                'model': str
            }
            Si stream=True: generador que emite chunks de respuesta
        """
        temperature = temperature if temperature is not None else self.temperature
        max_tokens = max_tokens if max_tokens is not None else self.max_tokens
        
        try:
            if stream:
                return self._call_ollama_stream(messages, temperature, max_tokens)
            else:
                return self._call_ollama(messages, temperature, max_tokens)
        except Exception as e:
            logger.error(f"Error en Ollama API: {e}", exc_info=True)
            raise
    
    def _call_ollama(
        self, 
        messages: List[Dict], 
        temperature: float, 
        max_tokens: int
    ) -> Dict:
        """
        Llamar a Ollama API local.
        
        Endpoint: POST http://localhost:11434/api/chat
        Docs: https://github.com/ollama/ollama/blob/main/docs/api.md
        """
        try:
            payload = {
                'model': self.model,
                'messages': messages,
                'options': {
                    'temperature': temperature,
                    'num_predict': max_tokens,  # max tokens a generar
                    'top_p': 0.9,
                    'top_k': 40,
                },
                'stream': False  # Respuesta completa, no streaming
            }
            
            logger.info(f"Llamando a Ollama: {self.ollama_url}/api/chat con modelo {self.model}")
            
            response = requests.post(
                f"{self.ollama_url}/api/chat",
                json=payload,
                timeout=self.timeout
            )
            response.raise_for_status()
            data = response.json()
            
            # Ollama retorna: 
            # {
            #   "message": {"role": "assistant", "content": "..."},
            #   "eval_count": 150,  # tokens de salida
            #   "prompt_eval_count": 50,  # tokens de entrada
            #   "done": true
            # }
            
            content = data['message']['content']
            tokens_input = data.get('prompt_eval_count', 0)
            tokens_output = data.get('eval_count', 0)
            tokens_total = tokens_input + tokens_output
            
            logger.info(
                f"Respuesta de Ollama: {len(content)} chars, "
                f"{tokens_total} tokens ({tokens_input} input + {tokens_output} output)"
            )
            
            return {
                'content': content,
                'tokens_used': tokens_total,
                'tokens_input': tokens_input,
                'tokens_output': tokens_output,
                'finish_reason': 'stop' if data.get('done') else 'length',
                'model': self.model,
            }
        
        except requests.exceptions.Timeout:
            logger.error(f"Timeout esperando respuesta de Ollama después de {self.timeout}s")
            raise Exception(
                f"El modelo tardó más de {self.timeout} segundos en responder. "
                "Considera usar un modelo más ligero (llama3.2:3b) o aumentar el timeout."
            )
        
        except requests.exceptions.ConnectionError:
            logger.error(f"No se pudo conectar a Ollama en {self.ollama_url}")
            raise Exception(
                f"No se pudo conectar a Ollama. Verifica que esté corriendo en {self.ollama_url}. "
                "Para iniciar: docker-compose up ollama"
            )
        
        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code
            
            if status_code == 404:
                logger.error(f"Modelo {self.model} no encontrado en Ollama")
                raise Exception(
                    f"Modelo '{self.model}' no encontrado. "
                    f"Descárgalo con: docker exec rep_drill_ollama ollama pull {self.model}"
                )
            else:
                logger.error(f"Error HTTP {status_code} de Ollama: {e.response.text}")
                raise Exception(f"Error en Ollama API: {e.response.text}")
        
        except KeyError as e:
            logger.error(f"Respuesta inesperada de Ollama: {data}")
            raise Exception(f"Respuesta malformada de Ollama: falta campo {e}")
    
    def _call_ollama_stream(
        self, 
        messages: List[Dict], 
        temperature: float, 
        max_tokens: int
    ):
        """
        Llamar a Ollama API con streaming habilitado.
        Retorna un generador que emite chunks de texto conforme Ollama los genera.
        
        Yields:
            Dict con campos: {'chunk': str, 'done': bool, 'tokens': int}
        """
        try:
            payload = {
                'model': self.model,
                'messages': messages,
                'options': {
                    'temperature': temperature,
                    'num_predict': max_tokens,
                    'top_p': 0.9,
                    'top_k': 40,
                },
                'stream': True  # Habilitar streaming
            }
            
            logger.info(f"Llamando a Ollama (streaming): {self.ollama_url}/api/chat con modelo {self.model}")
            
            # En streaming, timeout=(connect_timeout, read_timeout)
            # read_timeout=None significa sin límite para leer chunks
            response = requests.post(
                f"{self.ollama_url}/api/chat",
                json=payload,
                timeout=(10, None),  # 10s para conectar, sin límite para streaming
                stream=True  # requests en modo streaming
            )
            response.raise_for_status()
            
            # Ollama con stream=true retorna NDJSON (newline-delimited JSON)
            # Cada línea es un objeto JSON con un chunk de la respuesta
            import json
            accumulated_tokens = 0
            
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode('utf-8'))
                        
                        # Cada chunk tiene estructura:
                        # {
                        #   "message": {"role": "assistant", "content": "chunk de texto"},
                        #   "done": false,
                        #   "eval_count": N  (solo en el último)
                        # }
                        
                        chunk_content = data.get('message', {}).get('content', '')
                        is_done = data.get('done', False)
                        
                        if is_done:
                            # Último chunk: incluye conteo de tokens
                            tokens_input = data.get('prompt_eval_count', 0)
                            tokens_output = data.get('eval_count', 0)
                            accumulated_tokens = tokens_input + tokens_output
                            
                            yield {
                                'chunk': chunk_content,
                                'done': True,
                                'tokens': accumulated_tokens,
                                'finish_reason': 'stop'
                            }
                        else:
                            # Chunk intermedio
                            yield {
                                'chunk': chunk_content,
                                'done': False,
                                'tokens': 0
                            }
                    
                    except json.JSONDecodeError as e:
                        logger.error(f"Error decodificando chunk JSON: {e}")
                        continue
            
            logger.info(f"Streaming completado: {accumulated_tokens} tokens totales")
        
        except requests.exceptions.Timeout:
            logger.error(f"Timeout en streaming después de {self.timeout}s")
            raise Exception(f"Timeout en streaming después de {self.timeout} segundos")
        
        except requests.exceptions.ConnectionError:
            logger.error(f"Error de conexión con Ollama en {self.ollama_url}")
            raise Exception(f"No se pudo conectar a Ollama en {self.ollama_url}")
        
        except requests.exceptions.HTTPError as e:
            logger.error(f"Error HTTP en streaming: {e.response.status_code}")
            raise Exception(f"Error HTTP en streaming: {e.response.text}")
    
    def check_health(self) -> Dict[str, Any]:
        """
        Verifica que Ollama esté disponible y el modelo descargado.
        
        Returns:
            {
                'status': 'ok' | 'error',
                'ollama_running': bool,
                'model_available': bool,
                'models': list,
                'error': str (opcional)
            }
        """
        try:
            # 1. Verificar que Ollama responda
            response = requests.get(f"{self.ollama_url}/api/tags", timeout=5)
            response.raise_for_status()
            
            data = response.json()
            models = [m['name'] for m in data.get('models', [])]
            
            # 2. Verificar que el modelo configurado esté disponible
            model_available = self.model in models
            
            return {
                'status': 'ok' if model_available else 'warning',
                'ollama_running': True,
                'model_available': model_available,
                'configured_model': self.model,
                'available_models': models,
                'message': (
                    f"Modelo '{self.model}' disponible" if model_available
                    else f"Modelo '{self.model}' NO encontrado. Descárgalo con: ollama pull {self.model}"
                )
            }
        
        except Exception as e:
            logger.error(f"Error verificando health de Ollama: {e}")
            return {
                'status': 'error',
                'ollama_running': False,
                'model_available': False,
                'configured_model': self.model,
                'available_models': [],
                'error': str(e),
                'message': f"Ollama no está corriendo en {self.ollama_url}"
            }

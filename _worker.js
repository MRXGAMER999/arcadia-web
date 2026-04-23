export default {
  async fetch(request, env, ctx) {
    const response = await env.ASSETS.fetch(request);
    
    const accept = request.headers.get('Accept') || '';
    const contentType = response.headers.get('Content-Type') || '';
    
    if (accept.includes('text/markdown') && contentType.includes('text/html')) {
      const html = await response.text();
      
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : 'Arcadia';
      
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      let bodyText = '';
      if (bodyMatch) {
        bodyText = bodyMatch[1]
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      const markdown = `# ${title}\n\n${bodyText}`;
      
      return new Response(markdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Vary': 'Accept',
          'x-markdown-tokens': String(Math.ceil(markdown.length / 4)),
          'content-signal': 'ai-train=yes, search=yes, ai-input=yes'
        }
      });
    }
    
    if (contentType.includes('text/html')) {
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Vary', 'Accept');
      return newResponse;
    }
    
    return response;
  }
}

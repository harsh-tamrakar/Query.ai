
import { tavily } from '@tavily/core';
import { streamText } from 'ai';

import dotenv from 'dotenv';
import { SYSTEM_PROMPT, PROMPT_TEMPLATE } from './prompt';

import express from 'express';

dotenv.config();

const app = express();

app.use(express.json());

if (!process.env.TAVILY_API_KEY) {
  throw new Error('No TAVILY_API_KEY found. Add it to .env or set the environment variable.');
}

const tavilyClient = tavily({
  apiKey: process.env.TAVILY_API_KEY,
});


app.post("/perplexity_ask", async (req, res) => {

  // Step 1: Receive the query from the user
  const { query } = req.body; // expect body like { query: string }

    // Step 2  : make sure user has  access/credits to hit the endpoint

    // Step 3  : Check if we have web search indexed for a similar query

    // Step 4  : web search to gather sources 

  const webSearchResponse = await tavilyClient.search(query, {
    searchDepth: 'advanced',
  });

  const webSearchResult = webSearchResponse.results || [];


    // Step 5  : do some context engineering  on the prompt  + web search response

    
 const prompt =  PROMPT_TEMPLATE
 .replace("{{WEB_SEARCH_RESULTS}}" , JSON.stringify(webSearchResult))
    .replace("{{USER_QUERY}}" , query);


    // Step 6  : hit the llm and stream back the response 

      // Step 6: hit the LLM and stream back the response
   

      const result: any = await streamText({
        model: 'openai/gpt-5.4',
        prompt: prompt,
        system: SYSTEM_PROMPT,
      });

       res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Type', 'text/event-stream');
  
     
        for await (const textPart of result.textStream) {
          res.write(textPart);
        }


    
      res.write('\n-------SOURCES-------\n');

      // Step 7: also stream back the sources
      webSearchResult.forEach(result => 
        res.write(JSON.stringify(result) )
      )
      

      // Step 8: close the stream
      res.end();

 });

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
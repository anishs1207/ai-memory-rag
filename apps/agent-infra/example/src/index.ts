import { createAgent, tool } from "langchain";
import * as z from "zod";
import express from "express";

const app = express();
const PORT = 3000;

const getWeather = tool(
    (input) => `It's always sunny in ${input.city}!`,
    {
        name: "get_weather",
        description: "Get the weather for a given city",
        schema: z.object({
            city: z.string().describe("The city to get the weather for"),
        }),
    }
);

const agent = createAgent({
    model: "google-genai:gemini-2.5-flash-lite",
    tools: [getWeather],
});


app.get("/invoke", async (req, res) => {
    const query = req.query;

    // const response = await agent.invoke({
    //     messages: [{ role: "user", content: "What's the weather in San Francisco?" }],
    // })

    const response = 'dummy response';

    console.log("response", response);

    return res.status(200).json({
        response: response,
    })
})

app.listen(PORT, () => {
    console.log("Weather Agent has started");

})






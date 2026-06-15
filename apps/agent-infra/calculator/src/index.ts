import express from "express";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const precision = process.env.CALCULATOR_PRECISION ? parseInt(process.env.CALCULATOR_PRECISION, 10) : 2;

// Health check endpoint for the AgentOS readiness probe
app.get("/health", (req, res) => {
    return res.status(200).json({ status: "healthy" });
});

// Main invocation endpoint
app.get("/invoke", (req, res) => {
    const { num1, num2, op } = req.query;

    if (!num1 || !num2 || !op) {
        return res.status(400).json({ error: "Missing query parameters: num1, num2, or op" });
    }

    const val1 = parseFloat(num1 as string);
    const val2 = parseFloat(num2 as string);
    
    if (isNaN(val1) || isNaN(val2)) {
        return res.status(400).json({ error: "Parameters num1 and num2 must be valid numbers" });
    }

    let calculationResult = 0;

    switch (op) {
        case "add":
            calculationResult = val1 + val2;
            break;
        case "subtract":
            calculationResult = val1 - val2;
            break;
        case "multiply":
            calculationResult = val1 * val2;
            break;
        case "divide":
            if (val2 === 0) {
                return res.status(400).json({ error: "Division by zero" });
            }
            calculationResult = val1 / val2;
            break;
        default:
            return res.status(400).json({ error: "Unsupported operation. Must be: add, subtract, multiply, or divide" });
    }

    // Format output with the configured decimal precision
    const roundedResult = parseFloat(calculationResult.toFixed(precision));

    console.log(`[Calculator Agent] Executed calculation: ${val1} ${op} ${val2} = ${roundedResult}`);

    return res.status(200).json({
        agent: "calculator-agent",
        operation: op,
        inputs: { num1: val1, num2: val2 },
        result: roundedResult
    });
});

app.listen(PORT, () => {
    console.log(`Calculator Agent has started on port ${PORT}`);
});

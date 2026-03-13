import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function predictPerformance(data: any) {
  const model = "gemini-3-flash-preview";
  const prompt = `
    As an expert academic analyst, predict the performance of a student based on the following data:
    - Attendance: ${data.attendance}%
    - Internal Marks: ${data.internalMarks}/100
    - Assignment Marks: ${data.assignmentMarks}/100
    - Study Hours: ${data.studyHours} hours/week
    - Previous Semester Marks: ${data.previousMarks}/100

    Return the result in JSON format with the following fields:
    - prediction: "Excellent", "Good", "Average", or "Poor"
    - riskScore: A number from 0 to 100
    - explanation: A brief explanation of why this prediction was made.
    - recommendations: An array of 3 actionable suggestions for improvement.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Prediction error:", error);
    return {
      prediction: "Average",
      riskScore: 50,
      explanation: "Unable to generate AI prediction at this time.",
      recommendations: ["Maintain attendance", "Focus on assignments", "Increase study hours"]
    };
  }
}

export async function getChatbotResponse(message: string, context: any) {
  const model = "gemini-3-flash-preview";
  const prompt = `
    You are an AI Assistant for a Student Performance Prediction System. 
    Context:
    - Current Student Data: ${JSON.stringify(context)}
    - User Message: "${message}"

    Your tasks:
    1. Validate input data if provided (marks should be 0-100, attendance 0-100).
    2. Detect errors and suggest corrections.
    3. Explain prediction results if asked.
    4. Provide general assistance for faculty members.

    Keep your response concise and helpful.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }]
    });

    return response.text || "I'm sorry, I couldn't process that request.";
  } catch (error) {
    console.error("Chatbot error:", error);
    return "I'm having trouble connecting to my AI core. Please try again later.";
  }
}

// src/services/AutoAnswerService.ts

import { ChatOpenAI } from "@langchain/openai";
import { LLMChain }   from "langchain/chains";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Question }   from "../../naver/domain/Question";

export class AutoAnswerService {
    constructor(private readonly _chatModel: ChatOpenAI) {}

    /**
     * 질문 목록을 받아서 자동으로 답변을 생성합니다.
     */
    public async autoAnswer(questions: Question[]): Promise<void> {
        for (const question of questions) {
            console.log(`질문: ${question.title}`);
            const prompt = this.getPrompt(question);
            const answer = await this.invokeChatModel(prompt);
            question.addAnswer(answer);
            console.log(`답변: ${answer}`);
        }
    }

    /**
     * ChatPromptTemplate과 LLMChain을 이용해 string 답변을 반환합니다.
     */
    private async invokeChatModel(prompt: ChatPromptTemplate): Promise<string> {
        const chain = new LLMChain({ llm: this._chatModel, prompt });
        const result = await chain.call({});
        return result.text;
    }

    /**
     * 주어진 Question에 맞춰 ChatPromptTemplate을 생성합니다.
     */
    private getPrompt(question: Question): ChatPromptTemplate {
        return ChatPromptTemplate.fromMessages([
            { role: "system", content: this.createSystemMessage() },
            { role: "user",   content: this.createUserMessage(question) },
        ]);
    }

    private createSystemMessage(): string {
        return "You are a helpful assistant. Please respond in Korean.";
    }

    private createUserMessage(question: Question): string {
        return (
            "Please provide a response tailored to the user's question.\n\n" +
            `Question: ${question.title}\n\n` +
            "Answer:"
        );
    }
}

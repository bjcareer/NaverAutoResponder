import { AnswerValidationAgent } from './answer-validation.agent';
import { ChatOpenAI } from '@langchain/openai';

describe('AnswerValidationAgent', () => {
  let agent: AnswerValidationAgent;
  let mockChatModel: ChatOpenAI;

  beforeEach(() => {
    mockChatModel = {} as ChatOpenAI;
    agent = new AnswerValidationAgent(mockChatModel);
  });

  describe('validateAndRefine', () => {
    it('should remove numbered structure and excessive emojis', async () => {
      const automatedAnswer = `(1) 저도 같은 고민했어요.

📊 주요 비교:
- 적금: 안전
- 주식: 위험

(2) ✅ 제가 선택한 이유

(3) 💡 👉 여기에서 시작: https://example.com

※ 본 답변에는 유료 광고(제휴 링크)가 포함되어 있습니다.`;

      const refined = await agent.validateAndRefine(automatedAnswer);

      // Should remove numbers (1), (2), (3)
      expect(refined).not.toContain('(1)');
      expect(refined).not.toContain('(2)');
      expect(refined).not.toContain('(3)');

      // Should reduce excessive emojis
      const emojiCount = (refined.match(/[📊✅💡👉]/g) || []).length;
      expect(emojiCount).toBeLessThan(3); // Max 1-2 emojis

      // Should preserve essential content
      expect(refined).toContain('적금');
      expect(refined).toContain('주식');
      expect(refined).toContain('https://example.com');
      expect(refined).toContain('※ 본 답변에는 유료 광고(제휴 링크)가 포함되어 있습니다.');
    });

    it('should naturalize forced FOMO expressions', async () => {
      const automatedAnswer = `초반에 세팅해두면 이후가 편해요.
요즘 많은 사람들이 시작하고 있더라고요.

※ 본 답변에는 유료 광고(제휴 링크)가 포함되어 있습니다.`;

      const refined = await agent.validateAndRefine(automatedAnswer);

      // Should convert forced FOMO to natural expressions
      expect(refined).not.toContain('초반에 세팅해두면');
      expect(refined.toLowerCase()).toContain('저도'); // More personal tone
    });

    it('should remove marketing jargon', async () => {
      const automatedAnswer = `저는 본업 병행형으로는 이 방법이 좋았어요.
온보딩도 쉽고 미니 카피도 자연스럽더라고요.

※ 본 답변에는 유료 광고(제휴 링크)가 포함되어 있습니다.`;

      const refined = await agent.validateAndRefine(automatedAnswer);

      // Should remove marketing terms
      expect(refined).not.toContain('본업 병행형');
      expect(refined).not.toContain('온보딩');
      expect(refined).not.toContain('미니 카피');

      // Should preserve core message
      expect(refined).toContain('방법');
    });

    it('should preserve link and disclosure', async () => {
      const automatedAnswer = `이 방법 추천해요.

여기서 시작: https://deg.kr/example

※ 본 답변에는 유료 광고(제휴 링크)가 포함되어 있습니다.`;

      const refined = await agent.validateAndRefine(automatedAnswer);

      // Must preserve link
      expect(refined).toContain('https://deg.kr/example');

      // Must preserve exact disclosure
      expect(refined).toContain('※ 본 답변에는 유료 광고(제휴 링크)가 포함되어 있습니다.');
    });

    it('should maintain conversational tone', async () => {
      const automatedAnswer = `(1) 공감+정보 요약

주식 vs 적금 비교

(2) 선택 이유

※ 본 답변에는 유료 광고(제휴 링크)가 포함되어 있습니다.`;

      const refined = await agent.validateAndRefine(automatedAnswer);

      // Should have natural conversation markers
      expect(refined.toLowerCase()).toMatch(/저|제가|~더라고요|~거든요|~이에요/);

      // Should not have template structure indicators
      expect(refined).not.toContain('공감+정보');
      expect(refined).not.toContain('선택 이유');
    });
  });
});

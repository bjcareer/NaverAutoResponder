export class Question {
    private _answer: string | null = null;

    constructor(
        private readonly _title: string,
        private readonly _link: string,
        private readonly _answerCount: number,
    ) {}

    /** 답변을 설정합니다 */
    public addAnswer(answer: string): void {
        this._answer = answer;
    }

    /** 질문 제목 */
    public get title(): string {
        return this._title;
    }

    /** 질문 링크 */
    public get link(): string {
        return this._link;
    }

    /** 답변 수 */
    public get answerCount(): number {
        return this._answerCount;
    }

    /** 생성된 AI 답변 (없으면 null) */
    public get answer(): string | null {
        return this._answer;
    }
}

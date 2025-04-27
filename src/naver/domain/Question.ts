export class Question {
    private _answer: string | null = null;
    private _detailQuestion: string | null = null;

    constructor(
        private readonly _title: string,
        private readonly _link: string,
        private readonly _answerCount: number,
    ) {}

    /** 답변을 설정합니다 */
    public addAnswer(answer: string): void {
        this._answer = answer;
    }

    public addDetailQuestion(content: string): void {
        this._detailQuestion = content;
    }

    /** 질문 제목 */
    public get title(): string {
        return this._title;
    }

    public get detailQuestion(): string {
        return this._detailQuestion ?? '질문 내용을 찾지 못했습니다.';
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

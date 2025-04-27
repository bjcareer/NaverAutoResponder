

export class Question{
    constructor(
        private readonly _title: string,
        private readonly _link: string,
        private readonly _answer_count: number
    ) {
    }

    get title(): string {
        return this._title;
    }

    get link(): string {
        return this._link;
    }

    get answer_count(): number {
        return this._answer_count;
    }
}

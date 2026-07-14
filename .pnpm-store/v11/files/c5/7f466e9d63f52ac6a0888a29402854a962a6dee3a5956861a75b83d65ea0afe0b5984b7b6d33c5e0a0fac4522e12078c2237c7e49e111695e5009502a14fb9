interface SortedResult {
    id: string;
    url: string;
    type: 'page' | 'heading' | 'text';
    content: string;
    contentWithHighlights?: HighlightedText[];
}
type HighlightedText = {
    type: 'text';
    content: string;
    styles?: {
        highlight?: boolean;
    };
};
declare function createContentHighlighter(query: string | RegExp): {
    highlight(content: string): HighlightedText[];
};

export { type HighlightedText as H, type SortedResult as S, createContentHighlighter as c };

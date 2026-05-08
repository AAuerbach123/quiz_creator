export type ParsedQuizQuestion = {
  text: string;
  answer: string;
  notes?: string;
};

export type ParsedQuiz = {
  topic: string;
  questions: ParsedQuizQuestion[];
};

export interface QuizDocumentParser {
  parse(buffer: Buffer): Promise<ParsedQuiz[]>;
}

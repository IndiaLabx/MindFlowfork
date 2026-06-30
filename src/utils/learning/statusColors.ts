export type LearningStatus =
    | "mastered"
    | "review"
    | "tricky"
    | "clueless"
    | "known"
    | "familiar"
    | "new"
    | "unseen";

export function getLearningStatusColor(status?: LearningStatus): string {
    switch (status) {
        case "mastered":
            return "bg-green-500";
        case "review":
            return "bg-blue-500";
        case "tricky":
            return "bg-orange-500";
        case "clueless":
            return "bg-red-500";
        case "known":
            return "bg-teal-500";
        case "familiar":
            return "bg-cyan-500";
        case "new":
            return "bg-purple-500";
        case "unseen":
        default:
            return "bg-gray-300 dark:bg-gray-600";
    }
}

import { isValid } from "date-fns";

export const isValidDate = (date: string): boolean => {
    const dateObj = new Date(date);
    return isValid(dateObj);
}
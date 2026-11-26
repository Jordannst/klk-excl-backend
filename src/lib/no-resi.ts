export function hasDuplicateNoResiInRequest(noResiList: string[]): boolean {
  return new Set(noResiList).size !== noResiList.length;
}

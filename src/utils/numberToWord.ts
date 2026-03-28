export function numberToWords(amount: number): string {
  if (amount === 0) return "Zero Rupees Only";

  const belowTwenty = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const formatNumber = (num: number): string => {
    if (num < 20) return belowTwenty[num];
    if (num < 100)
      return tens[Math.floor(num / 10)] + " " + belowTwenty[num % 10];
    if (num < 1000)
      return (
        belowTwenty[Math.floor(num / 100)] +
        " Hundred " +
        formatNumber(num % 100)
      );
    if (num < 100000)
      return (
        formatNumber(Math.floor(num / 1000)) +
        " Thousand " +
        formatNumber(num % 1000)
      );
    if (num < 10000000)
      return (
        formatNumber(Math.floor(num / 100000)) +
        " Lakh " +
        formatNumber(num % 100000)
      );

    return (
      formatNumber(Math.floor(num / 10000000)) +
      " Crore " +
      formatNumber(num % 10000000)
    );
  };

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let words = "";

  if (rupees > 0) {
    words += formatNumber(rupees).trim() + " Rupees";
  }

  if (paise > 0) {
    words += (words ? " and " : "") + formatNumber(paise).trim() + " Paise";
  }

  return words + " Only";
}

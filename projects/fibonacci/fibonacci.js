function fib(n) {
  if (n === 0) {
    return [0];
  }
  if (n === 1) {
    return [0, 1];
  }

  let fibonacciArray = [0, 1];

  for (let i = 2; i <= n; i++) {
    fibonacciArray.push(fibonacciArray[i - 1] + fibonacciArray[i - 2]);
  }

  return fibonacciArray;
}

document.addEventListener('DOMContentLoaded', function () {
  const fibNumberInput = document.getElementById('fibNumber');
  const calculateButton = document.getElementById('calculateButton');
  const fibResult = document.getElementById('calculatedFib');
  const displayElement = document.getElementById('displayNumbers');

  calculateButton.addEventListener('click', function () {
    const n = parseInt(fibNumberInput.value);
    if (!isNaN(n) && n >= 0) {
      const fibonacciArray = fib(n);
      const result = fibonacciArray[n];
      fibResult.textContent = `Fibonacci(${n}) = ${result}`;

      const firstFive = fibonacciArray.slice(0, 5).join(', ');
      const lastThree = fibonacciArray.slice(-3).join(', ');

      displayElement.textContent = `${firstFive} ... ${lastThree}`;
    } else {
      fibResult.textContent = 'Please enter a non-negative integer';
      displayElement.textContent = '';
    }
  });
});

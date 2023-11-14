function fib(n) {
  if (n === 0) {
    return 0;
  }
  if (n === 1) {
    return 1;
  }

  let a = 0;
  let b = 1;
  let temp;

  for (let i = 2; i <= n; i++) {
    temp = a + b;
    a = b;
    b = temp;
  }

  return b;
}



document.addEventListener('DOMContentLoaded', function() {
  const fibNumberInput = document.getElementById('fibNumber');
  const calculateButton = document.getElementById('calculateButton');
  const fibResult = document.getElementById('calculatedFib');


  calculateButton.addEventListener('click', function(){
    const n = parseInt(fibNumberInput.value);
    if(!isNaN(n)){
      const result = fib(n);
      fibResult.textContent = `Fibonacci(${n}) = ${result}`;
    } else {
      fibResult.textContent = 'Please enter a number between 1-250'
    }
  })
})
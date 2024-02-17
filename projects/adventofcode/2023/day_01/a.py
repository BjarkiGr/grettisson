input = open('projects/adventofcode/2023/day_01/input_A.txt', 'r')
lines = input.readlines()

numbers = []

def isNumber(n):
  try:
    int(n)
  except ValueError:
    return None
  return n

for i in range(len(lines)):
  numbers.append([])
  for letter in lines[i]:
    if(isNumber(letter) != None):
      numbers[i].append(letter)
      

sum = 0

for item in numbers:
  length = len(item)-1
  sum += int(item[0] + item[length])
  
print(sum)
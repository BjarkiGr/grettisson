input = open('projects/adventofcode/2023/day_01/input_A.txt', 'r')
lines = input.readlines()

numbersInText = [["one", 1], ["two", 2], ["three", 3], ["four", 4], ["five", 5], ["six", 6], ["seven", 7], ["eight", 8], ["nine", 9], ["zero", 0]]

    
numbers = []

def isNumber(n):
  try:
    int(n)
  except ValueError:
    return None
  return n

newList = []

def isNumberText(n):
  wordList = []
  for word in numbersInText:
    if(word in n):
      wordList.append(word)
  return wordList

def replaceWordsWithLetters(n):
  newWord = n
  for i in range(len(checkIndexOfWord(n))):
    newWord = newWord.replace(checkIndexOfWord[i], checkIndexOfWord[i])
  return newWord

def checkIndexOfWord(n):
  wordOrder = []
  for i in range(len(numbersInText)):
    if(numbersInText[i] in n):
      wordOrder.append([numbersInText[i], n.index(numbersInText[i])])
      
  return sorted(wordOrder, key=lambda x:x[1])


for i in range(5):
  numbers.append([])
  lines[i] = replaceWordsWithLetters(lines[i])
  print(lines[i])
  for letter in lines[i]:
    if(isNumber(letter) != None):
      numbers[i].append(letter)


sum = 0

for item in numbers:
  length = len(item)-1
  sum += int(item[0] + item[length])
  
print(sum)
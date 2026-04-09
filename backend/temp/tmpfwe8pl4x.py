n = int(input())
result = []
while n != 1:
    result.append(str(n))
    if n % 2 == 0:
        n //= 2
    else:
        n = 3 * n + 1
result.append("1")
print(" ".join(result))

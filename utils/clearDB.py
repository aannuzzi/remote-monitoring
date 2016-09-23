import requests

r = requests.delete('http://localhost:5000/alldata')
print r.status_code
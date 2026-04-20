const fs = require('fs');
const https = require('https');

const urls = {
    "register.html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2MwMmI1OTZlNDQ1NzQwNWM5N2ZhMDM4YjY2YmJiMGMxEgsSBxDatszZ9BMYAZIBIwoKcHJvamVjdF9pZBIVQhM2NzY0NzQzMjY4MzQxMTcyMTg0&filename=&opi=89354086",
    "booking.html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2Q1OTNlMzk2OWI1ODQzYjQ5ZTA2MGFiNzgxZWE3NjI2EgsSBxDatszZ9BMYAZIBIwoKcHJvamVjdF9pZBIVQhM2NzY0NzQzMjY4MzQxMTcyMTg0&filename=&opi=89354086",
    "salons.html": "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzQ0NzQ0YzA2ODNiOTQxMTk5ZGUwOTU2ZjNhYjVjMDVlEgsSBxDatszZ9BMYAZIBIwoKcHJvamVjdF9pZBIVQhM2NzY0NzQzMjY4MzQxMTcyMTg0&filename=&opi=89354086"
};

for (const [name, url] of Object.entries(urls)) {
    https.get(url, (res) => {
        const file = fs.createWriteStream(name);
        res.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log(`Downloaded ${name}`);
        });
    });
}

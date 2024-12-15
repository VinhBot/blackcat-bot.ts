import { Config } from "./types";
import dotenv from "dotenv";
dotenv.config();

export const config: Config = {
    botToken: process.env.botToken as string,
    mongourl: "mongodb+srv://BlackCat-Club:blackcat2k3@blackcat-club.sfgyw.mongodb.net/",
    botPrefix: "!",
    developer: "",

    spotifyClientId: "fc0d728b397c4f8398d2a13345c6d47c",
    spotifyClientSecret: "a2a3e65a22b64357a6791b66cd1de4b5",
    youtubeCookie:  "VISITOR_INFO1_LIVE=KAnwPD-vmGE; SID=GQjPfJXVkW63JHdicSKmT7jbzh-rAOS21sbAsa3tsteMoA44OMykWx9Qwr_dIcBhRxjRjg.; __Secure-1PSID=GQjPfJXVkW63JHdicSKmT7jbzh-rAOS21sbAsa3tsteMoA44pYGTKv1KrWPlvs9xxPQ41g.; __Secure-3PSID=GQjPfJXVkW63JHdicSKmT7jbzh-rAOS21sbAsa3tsteMoA44Z4qDi8CFg8WW2a3kcmbMYg.; HSID=Azu4HJa3AIG0PC2SL; SSID=AxCDXBMAGZoY13kvP; APISID=KwWgVTNlitJzn9UQ/A0lr9IhyijPgPW6Ha; SAPISID=9I3XSSvUyxZH4vHf/AOjIyZKuW8ZGgq-1s; __Secure-1PAPISID=9I3XSSvUyxZH4vHf/AOjIyZKuW8ZGgq-1s; __Secure-3PAPISID=9I3XSSvUyxZH4vHf/AOjIyZKuW8ZGgq-1s; YSC=qfXIawav8Hk; LOGIN_INFO=AFmmF2swRgIhAM3-5bd0gVsZ544PemCs1lHbAImxGsSm8COAnk5eLA83AiEA97NSeJZwOehvW2WA9AM8Tt1rB-YmzwYp4xbtlCmR3Hk:QUQ3MjNmeGVjcTV3QVhGS05PYmFRSWZwdXZlMS1DNU9RSW53Zm5JZDBjaTBxdjJnanV4dmR3UGJWeWVPNHJlUndCS3gzczdRQXVWdFRtRWlkaER6MFdLZEJlTHh5ZFZMaWpreGFWQVpjVEs2TTdZemtaRGM4eHVpeFd2c3lrbUhrTDRKNG5FWU9LU3BFZ0QyQkNhUktOQzhiZWJlSDY5a2hR; PREF=tz=Asia.Bangkok&f6=400; SIDCC=AJi4QfE3mhs3Iwk0sITqhGMHmYE3Y25SIBjIbA2ph0C1tA5uoi-kIUvkM962NBXAz23ShYwgbA; __Secure-3PSIDCC=AJi4QfEMsvf7I1nYqRXINYYCVQQaOc1D1N_lIyxKzVgmScwoqWnMHEimjWvMm-MLZPzN6Ywx",
};
const billsWithInterests = []
const politicians = {}


const createPolitician = (id, firstName, lastName, bills) => ({
    id: id,
    name: `${firstName} ${lastName}`,
    bills: bills,
    relatedPacs: [],
    influencingCorporations: []
})

fetch("http://localhost:8088/legislations")
    .then(r => r.json())
    .then(bills => {
        const promiseArray = []
        for (const bill of bills) {
            bill.interests = []
            promiseArray.push(fetch(`http://localhost:8088/legislationinterests?legislationId=${bill.id}&_expand=interest`)
                .then(r => r.json())
                .then(legInt => {
                    bill.interests = legInt.map(li => li.interest.about)
                    billsWithInterests.push(bill)
                }))
        }

        return Promise.all(promiseArray)
    })
    .then(() => {
        return fetch("http://localhost:8088/politicianlegislations?&_expand=legislation&_expand=politician")
            .then(r => r.json())
            .then(polLegs => {
                polLegs.forEach(pl => {
                    const matchingBills = billsWithInterests.filter(b => b.id === pl.legislationId)

                    const pol = createPolitician(
                        pl.politician.id,
                        pl.politician.name.first,
                        pl.politician.name.last,
                        matchingBills
                    )

                    // Is the current politician being tracked or not?
                    if (pl.politician.id in politicians) {
                        politicians[pol.id].bills.push(...pol.bills)
                    } else {
                        politicians[pol.id] = pol
                    }
                })

            })
    }).then(() => {
        return fetch("http://localhost:8088/pacinterests?_expand=pac&_expand=interest")
            .then(response => response.json())
            .then((pacInterestRelationships) => {
                console.log(pacInterestRelationships)

                // Look at every PAC/Interest relationship
                for (const pacInterestRelationship of pacInterestRelationships) {
                    const pacInterest = pacInterestRelationship.interest.about
                    const pacName = pacInterestRelationship.pac.registeredName

                    // For each interest, look at each politician's bill's interests
                    // If there is a match, add the current PAC to the `relatedPACs`
                    // key of the politician
                    for (const politician of Object.values(politicians)) {
                        politician.bills.map(b => b.interests)
                            .flat()
                            .forEach(billInterest => {
                                if (billInterest === pacInterest) {
                                    const pacExists = politician.relatedPacs.find(rp => rp.id === pacInterestRelationship.pac.id) || {}
                                    if ("id" in pacExists === false) {
                                        politician.relatedPacs.push(pacInterestRelationship.pac)

                                    }
                                }
                            })
                    }
                }
            })
    }).then(() => {
        return fetch("http://localhost:8088/pacdonations?_expand=corporation&_expand=pac")
            .then(response => response.json())
            .then((pacdonations) => {
                for (const pacDonate of pacdonations) {
                    const donatingCorporation = pacDonate.corporation
                    const pacDonatedTo = pacDonate.pac

                    // Iterate politicians
                    for (const politician of Object.values(politicians)) {

                        // Iterate the politician's related PACs
                        for (const pac of politician.relatedPacs) {

                            /*
                                If the PAC is related to a politician and received
                                a donation from a corporation, add that corporation
                                to the array of possible influencers of the politician
                            */
                            if (pac.id === pacDonatedTo.id) {
                                const corpExists = politician.influencingCorporations
                                    .find(c => c.id === donatingCorporation.id) || {}
                                if ("id" in corpExists === false) {
                                    politician.influencingCorporations.push(donatingCorporation)
                                }
                            }
                        }
                    }
                }
            })
    })
    .then(() => {
        const container = document.querySelector("#container")

        for (const politician of Object.values(politicians)) {
            container.innerHTML += `
            <article class="politician">
                <header class="politician__name">
                    <h1>${politician.name}</h1>
                </header>
                <section class="politician__bills">
                    <h3>Sponsored Bills</h3>
                    ${politician.bills.map(b => {
                        return `
                            <div>
                                <h4>${b.name}</h4>
                                <ul>
                                    ${b.interests.map(i => {
                                        return `<li>${i}</li>`
                                    }).join("")}
                                </ul>
                            </div>
                        `
                    }).join("")}
                </section>
                <section class="politician__funders">
                    <h3>Related PACs</h3>
                    <ul>
                    ${politician.relatedPacs.map(pac => {
                        return `<li>${pac.registeredName}</li>`

                    }).join("")}
                    </ul>
                </section>
                <section class="politician__influencers">
                    <h3>Influencing Corporations</h3>
                    <ul>
                    ${politician.influencingCorporations.map(corp => {
                        return `<li>${corp.company}</li>`
                    }).join("")}
                    </ul>
                </section>
            </article>
            `
        }
    })

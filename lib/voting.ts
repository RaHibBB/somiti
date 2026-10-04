// Proposal voting rules (constitution, spec §1). Pure functions, unit-tested.
//
// - One member, one vote, regardless of shares.
// - The vote is valid only if MORE than 50% of active members voted.
// - Yes > No → passed. No ≥ Yes (including a tie) → rejected.

export type VoteOutcome = "passed" | "rejected" | "invalid"

export type Tally = {
  yes: number
  no: number
  voted: number
  activeMembers: number
  /** Votes needed for a valid result: floor(active / 2) + 1. */
  quorum: number
  quorumMet: boolean
  outcome: VoteOutcome
}

export function quorumFor(activeMembers: number): number {
  return Math.floor(activeMembers / 2) + 1
}

export function tally(yes: number, no: number, activeMembers: number): Tally {
  const voted = yes + no
  const quorum = quorumFor(activeMembers)
  // "More than 50%": voted / active > 1/2  ⇔  2·voted > active
  const quorumMet = activeMembers > 0 && voted * 2 > activeMembers
  const outcome: VoteOutcome = !quorumMet ? "invalid" : yes > no ? "passed" : "rejected"
  return { yes, no, voted, activeMembers, quorum, quorumMet, outcome }
}

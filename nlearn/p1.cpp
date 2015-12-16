#include <stdlib.h>
#include <math.h>

#include "MatchRes.h"
#include "DistMetric.h"


TextMetric dm;

#define min2(a, b) ( (a) < (b) ? (a) : (b) )
#define min3(a, b, c) ( (a) < (b) ? min2(a, c) : min2(b, c) )

#define DIST_THRESHOLD 0.2

#define FIND_OVERLAPS


#define MAX_DIST 100000000

#define dist(a, b) dist[(a)*(slen+1)+(b)]


#define NONE 4
#define SUBST 1
#define DELETE 2
#define INSERT 3


int getMatch(int *dist, const char *p, const char *s, int plen, int slen,
					int sEnd, char *& opmap) {
  // If we need to print the match, then we need to create the
  // string s1 and p1 that are obtained by aligning the matching
  // portion of s with p, and inserting '-' characters where 
  // insertions/deletions take place. 
  //
  // If we dont need to print, then we need only compute the 
  // beginning of the match, which is in "j" at the end of the loop below

  int i = plen, j = sEnd; 
  int k = i+sEnd+1; 
  int rv;

  char *op = (char *)malloc(k+1);
  op[k--] = 0;

  while ((i > 0) && (j > 0)) {
	char sc = s[j-1], pc = p[i-1];
	int curDist = dist(i, j);
	if (curDist == dist(i-1, j) + dm.delCost(pc)) {
	  op[k] = DELETE;
	  i--;
	}
	else if (curDist == dist(i, j-1) + dm.insCost(sc)) {
	  op[k] = INSERT;
	  j--;
	}
	else {
	  if (dm.subCost(pc, sc) == 0)
		op[k] = NONE;
	  else op[k] = SUBST;
	  i--; j--;
	}
	k--;
  }

  k++;
  rv = j;
  opmap = strdup(&op[k]);
  free(op);
  return rv;
}

MatchRes&
p1Match(const char* p, const int plen, const char* s, const int slen,
    		int sOffset, MatchRes& mres) {
  int i, j, l;
  int sBeg, sEnd;
  int bestDist=MAX_DIST;
  int prevBest;
  int distDn=0, distRt=0, distDiag=0;
  int* dist;
  char *opmap;

  if ((dist = (int *)malloc((plen+1)*(slen+1)*sizeof(int *))) == NULL) {
	  //printf("dist is NULL!\n");
  	exit(-1);
  }

  MatchRes& rv = mres;
  int costThresh;

  // Initialize costThresh from mres parameter. If mres parameter (now in rv)
  // is not initialized, compute it from DIST_THRESHOLD.

  if (rv.costThresh_ < 0) { 
  	int maxCost = 0; 
  	prevBest = MAX_DIST;
  	for (i = 0; i < plen; i++)
  	  maxCost += dm.delCost(p[i]);
  	costThresh = (int)floorf(DIST_THRESHOLD * maxCost);
  	rv.costThresh_ = costThresh;
  }
  else {
  	prevBest = rv.bestDist_;
  	costThresh = rv.costThresh_;
  }

  // Initialize distance matrix

  dist(0, 0) = 0;
  for (j=1; j <= slen; j++)
  	dist(0, j) = 0;
  for (i=1; i <= plen; i++)
  	dist(i, 0) = dist(i-1, 0) + dm.delCost(p[i-1]);

  // Main loop: compute the minimum distance matrix

  for (i = 1; i <= plen; i++) {
  	for (j = 1; j <= slen; j++) {
  	  char sc = s[j-1], pc = p[i-1];
  	  distDn = dist(i-1, j) + dm.delCost(pc);
  	  distRt = dist(i, j-1) + dm.insCost(sc);
  	  distDiag = dist(i-1, j-1) + dm.subCost(pc, sc);
      dist(i, j) = min3(distDn, distRt, distDiag);
  	}
  }

  /* Now, look for j such that dist(plen, j) is minimum.
	 This gives the lowest cost substring match between p and s */

  sEnd = 1;
  for (j=1; j <= slen; j++) {
  	if (dist(plen, j) < bestDist) {
  	  bestDist = dist(plen, j);
  	  sEnd = j;
  	}
  }
  // TODO: why do we care about the best match only?

  // Compare the best with previous best matches to see if there is any
  // sense in continuing further. We retain results that are below costThresh
  // that are within 50% of costThresh from the best result so far.

  if (bestDist <= prevBest + (costThresh/2)) {
	int bestSoFar = min(bestDist, prevBest);
	rv.bestDist_ = bestSoFar;

	if (bestDist < prevBest) {
	  for (MatchesIt mi=rv.elem_.begin(); mi != rv.elem_.end();) {
		if ((mi->dist_ > costThresh)&&(mi->dist_ > bestDist+(costThresh/2))) {
		  MatchesIt mi1 = mi;
		  mi++;
		  rv.elem_.erase(mi1);
		}
		else mi++;
	  }
	}

  sBeg = getMatch(dist, p, s, plen, slen, sEnd, opmap);

	MatchResElem mre(bestDist, sBeg + sOffset, sEnd-1 + sOffset, opmap);
	rv.elem_.push_front(mre);

	// Now, compare the best match with other possible matches 
	// identified in this invocation of this function

#ifdef FIND_OVERLAPS
	for (l=1; l <= slen; l++) {
	  int currDist  = dist(plen, l);
	  if (((currDist <= costThresh) ||
		   (currDist <= bestSoFar + (costThresh/2))) &&
		  // The first two tests below eliminate consideration of distances
		  // that do not correspond to local minima
		  (currDist < dist(plen, l-1)) && 
		  ((l == slen) || currDist < dist(plen, l+1)) &&
		  (l != sEnd)) /* Dont consider the global minima, either */ {

		j = getMatch(dist, p, s, plen, slen, l, opmap);

		/* s[j]...s[l-1] are included in the match with p */

		// Eliminate matches that have large overlap with the main match.
		// This is necessary since the "non-local minima" test earlier misses
		// situations where the distance increases briefly but then
		// decreases after a few more characters. In that case, you seem to
		// have a local minima, but the corresponding match is subsumed in
		// the ultimate match that is discovered.

		int uniqLen=0;
		if (j < sBeg)
		  uniqLen += sBeg-j;
		if (l > sEnd)
		  uniqLen += l-sEnd;
		if (uniqLen > (plen*DIST_THRESHOLD)) {
		  MatchResElem mre(bestDist, j + sOffset, l-1 + sOffset, opmap);
		  rv.elem_.push_front(mre);
		}
	  } // if ((currDist <= costThresh) ...
	} // for (l=1; ...
#endif
  } // if (bestDist <= ...
  free(dist);
  return rv;
}

/*
  NOTE: In the fastmatch algorithm below, and its proof of correctness, we
  only consider insertions and deletions, thus treating a substitution as
  a combination of the two. In reality, the D metric treats substitutions
  differently. But the cost function for substitution is set up to be very
  close to insertion+deletion cost except in two cases: case-folding, and
  substitution of one white space character with another. We handle these
  two cases by using the "normalize" function below to map all alphabetic
  characters into upper case and by mapping all white space character to '_'
*/


/*
  The following fastmatch algorithm computes a fast approximation of the
  distance between a string p and substrings of s. It ensures that

  [A] For any s1=s[i...j] such that D(p, s1) <= t, p1FastMatch will
      invoke p1Match(p, s2) for some string s2 that contains s1 as
	  a substring. 

  The algorithm operates by comparing p with every substring 
  s_k = s[k-plen+1...k] that is of length plen. It computes an 
  approximation FD(p, s_k). Let k_1...k_2 be any maximal subrange
  of [0...slen-1] such that FD(p, s_l) <= t' for k_1 <= l <= k_2. 
  Then it invokes p1Match(p, s[k_1-plen+1...k_2]). 

  To be useful, FD for all s_k should be computable in time that is linear
  in slen. To do this, we define FD as follows. Let P denote the multiset
  of characters in p, i.e., the number of occurrences of each character in
  p is preserved in P, but their order of occurrence isn't. Similarly, let
  S_k denote the multiset of characters in s_k. We define

    P^u_k = P - S_k   [Denotes characters in p that are "unmatched" by 
                      characters in S_k. "-" denotes set difference operation.]
	S^u_k = S_k - P   [Chars in S_k unmatched by characters in p]
	FD(p, s_k) = DelCost(P^u_k) + InsCost(S^u_k)

  Note that FD(p, s_k) <= D(p, s_k): in order to make s_k the same as p,
  you will at least need to delete every characters in P^u_k from p, and then
  insert all the characters in S^u_k. However, it is not enough to set a
  the same threshold on FD as D, or otherwise we can't ensure [A]. So we
  define FD in a slightly different way that lets us use a threshold as t:

        FD(p, s_k) = min(DCost(P^u_k), ICost(S^u_k))

  We can compute both the above quantities in an incremental way as k
  goes from plen-1 to slen.

  We will now show that [A] holds if FD is defined as above. There are two 
  cases to consider for our proof, depending on whether s1=s[i...j] is longer 
  than or shorter than p. 

  1. |s1| >= plen. We will show that for every substring s_k of s1, 
     ICost(S^u_k) <= t. (Since s1 = s[i...j], it must be the case that
	 i+plen-1 <= k <= j.) Suppose it is not. Note that S^u_k contains the
	 "excess" characters in s_k that aren't matched by any character in p.
	 Since s_k is a substring of s1, all these characters are included in
	 s1 as well, and must be deleted before s1 can be identical to p. 
	 Thus D(p, s1) >= ICost(S^u_k) > t, which contradicts the assumption
	 that D(p, s1) <= t.

  2. |s1| < plen. We will show that for the superstring s_j = s[j-plen+1...j]
     of s1, DCost(P^u_j) <= t. Suppose it is not. Then p has P^u_j unmatched 
	 characters in s_j. Since s1 is a substring of s_j, all these will
	 continue to be unmatched in s1, which means that 
	 D(p, s1) >= DCost(P^u_j) > t,  again contradicting our assumption.

  To show that the definition FD above captures a necessary condition,
  we can give examples in case 1 where D(p, s1) = ICost(S^u_k). Consider
	    xxxxyyyyxxxx     <--- p     P^u_k = {xx}
       xzxxxyyyyxxxzx    <--- s1    S^u_k = {zz}
  Assume ICost and DCost are equal, and are also equal for all characters.
*/ 

inline void
adjustDiffIns(char c, short vec[], int& idiff, int& ddiff) {
  if (vec[c] > 0) // an excess of c in p, now reduced when c is added to s
	ddiff -= dm.delCost(c);
  else // an excess of c in s, now excess further increased
	idiff += dm.insCost(c);
  vec[c]--;
}

inline void
adjustDiffDel(char c, short vec[], int& idiff, int& ddiff) {
  if (vec[c] >= 0) // an excess of c in p, further increased now
	ddiff += dm.delCost(c);
  else // an excess of c in s, excess being reduced now, so decrease
	idiff -= dm.insCost(c); // insertion cost correspondingly.
  vec[c]++;
}


extern "C" {
int* p1FastMatch(const char* p, const char* s) {

  int plen = strlen(p);
  int slen = strlen(s);

  int idiff=0, ddiff=0, diff;
  int diffThresh;
  int start=-1, end=-1;
  short diffVec[256];
  MatchRes rv;

  rv.costThresh_ = -1;
  rv.bestDist_ = MAX_DIST;

  memset(diffVec,0, sizeof(diffVec));

  for (int i=0; i < plen; i++) {
  	char c = dm.normalize(p[i]);
  	adjustDiffDel(c, diffVec, idiff, ddiff);
  }

  diffThresh = (int)floorf(ddiff*DIST_THRESHOLD);

  for (int i=0; i < plen; i++) {
  	char d = dm.normalize(s[i]);
  	adjustDiffIns(d, diffVec, idiff, ddiff);
  }

  diff = min(idiff, ddiff);
  //  assert(idiff==ddiff);

  if (diff <= diffThresh)
  	start = 0;

  for (int j=plen; j < slen; j++) {
  	char c = dm.normalize(s[j-plen]);
  	char d = dm.normalize(s[j]);

  	adjustDiffDel(c, diffVec, idiff, ddiff);
  	adjustDiffIns(d, diffVec, idiff, ddiff);
  	diff = min(idiff, ddiff);

  	if (start == -1) {
  	  if (diff <= diffThresh)
    		start = j-plen+1;
  	}
  	else if (diff > diffThresh) {
  	  end = j+1;//-1+diffThresh;
  	  if (end >= slen) 
    		end = slen;
  	  start -= 1;//diffThresh;
  	  if (start < 0)
    		start = 0;

  	  p1Match(p, plen, &s[start], end-start+1, start, rv);
  	  start = -1;
  	  //j = end-1;
  	}
  }

  if (start != -1) {
  	end = slen-1;
  	p1Match(p, plen, &s[start], end-start+1, start, rv);
  }

  int* arr = (int*) malloc(sizeof(int)*(rv.elem_.size()*2+1));
  arr[0] = rv.elem_.size()*2;
  int i = 1;
  for (MatchesTi mi = rv.elem_.rbegin(); mi != rv.elem_.rend(); mi++, i=i+2) {
    arr[i] = mi->matchBeg_;
    arr[i+1] = mi->matchEnd_;
  }
  return arr;

}
}

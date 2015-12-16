#ifndef MATCHELEM_H
#define MATCHELEM_H

#include <list>

using namespace std;

class MatchResElem {
 public:
  int dist_;		// edit distance
  int matchBeg_;	// start and
  int matchEnd_;	//   end of match
  char *opmap_;		// table of edit operator costs

 public:
  MatchResElem(int d, int b, int e, char *opmap) 
	{dist_ = d; matchBeg_ = b; matchEnd_ = e; opmap_ = opmap; };
};

typedef list<MatchResElem> Matches;
typedef list<MatchResElem>::iterator MatchesIt;
typedef list<MatchResElem>::reverse_iterator MatchesTi;


class MatchRes {
// represents a Match Result as returned by p1FastMach
 public:
  int costThresh_;	// minimum edit distance for matches
  int bestDist_;	// best obseved edit distance in the matches found
  Matches elem_;	// list of matches found
} ;

#endif

"""
Service for calculating Functional Zero status based on HUD benchmarks.
Functional Zero is achieved when:
- Fewer than 3 people experiencing homelessness per 10,000 in the community
- Or fewer than 0.1% of the total population
"""

class FunctionalZeroCalculator:
    @staticmethod
    def calculate_status(coc_id: str, homeless_population: int, total_population: int) -> dict:
        """
        Calculate Functional Zero status for a CoC.
        
        Args:
            coc_id: Continuum of Care ID
            homeless_population: Current number of people experiencing homelessness
            total_population: Total population of the area
            
        Returns:
            Dictionary with status details
        """
        # Calculate rate per 10,000 people
        rate_per_10k = (homeless_population / total_population) * 10000
        
        # Calculate percentage
        percentage = (homeless_population / total_population) * 100
        
        # Determine status based on HUD benchmarks
        # Benchmark: fewer than 3 people per 10,000
        is_functional_zero = rate_per_10k < 3
        
        # Benchmark population for reference
        benchmark_population = int((total_population / 10000) * 3)
        
        return {
            "coc_id": coc_id,
            "status": "functional_zero" if is_functional_zero else "not_achieved",
            "rate_per_10k": round(rate_per_10k, 2),
            "percentage": round(percentage, 3),
            "current_population": homeless_population,
            "benchmark_population": benchmark_population,
            "difference": homeless_population - benchmark_population
        }
    
    @staticmethod
    def calculate_trend(historical_data: list) -> dict:
        """
        Calculate trend in homelessness numbers over time.
        
        Args:
            historical_data: List of tuples (year, population)
            
        Returns:
            Dictionary with trend analysis
        """
        if len(historical_data) < 2:
            return {"trend": "insufficient_data"}
        
        # Calculate year-over-year changes
        changes = []
        for i in range(1, len(historical_data)):
            prev_year, prev_pop = historical_data[i-1]
            curr_year, curr_pop = historical_data[i]
            change = curr_pop - prev_pop
            pct_change = (change / prev_pop) * 100 if prev_pop > 0 else 0
            changes.append({
                "year": curr_year,
                "change": change,
                "percentage_change": round(pct_change, 2)
            })
        
        # Determine overall trend
        recent_changes = changes[-3:] if len(changes) >= 3 else changes
        avg_change = sum(c["change"] for c in recent_changes) / len(recent_changes)
        
        if avg_change < 0:
            trend = "decreasing"
        elif avg_change > 0:
            trend = "increasing"
        else:
            trend = "stable"
        
        return {
            "trend": trend,
            "average_change": round(avg_change, 2),
            "year_over_year": changes
        }